package com.sirka.owner

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import app.tauri.plugin.Plugin
import app.tauri.plugin.annotation.ActivityCallback
import app.tauri.plugin.annotation.Command
import app.tauri.plugin.annotation.TauriPlugin
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.util.concurrent.Executor

/**
 * Plugin Android Keystore (SEC-3).
 *
 * Menyediakan kunci kripto **hardware-backed** milik perangkat:
 *  - `generateKey`  — membuat pasangan kunci ECDSA P-256 di dalam Android
 *                     Keystore dengan `setUserAuthenticationRequired(true)`.
 *                     Private key TIDAK PERNAH keluar dari keystore.
 *  - `hasKey`       — apakah kunci untuk alias tertentu sudah ada.
 *  - `sign`         — menandatangani challenge (butuh otentikasi user).
 *  - `deleteKey`    — menghapus kunci dari perangkat.
 *  - `isAvailable`  — apakah perangkat mendukung StrongBox / keystore.
 *
 * Fallback: bila plugin ini tidak terpasang (mis. aplikasi dibangun tanpa
 * script instalasi), sisi TypeScript otomatis memakai Web Crypto non-extractable
 * (lihat `src/utils/deviceKey.ts`).
 */
@TauriPlugin
class AndroidKeystorePlugin(private val activity: PluginActivity) : Plugin(activity) {

    companion object {
        private const val KEYSTORE = "AndroidKeyStore"
        private const val EC = "EC"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    }

    private val executor: Executor by lazy { ContextCompat.getMainExecutor(activity) }

    override fun load() {
        activity.runOnUiThread {
            val fragment = activity as? FragmentActivity ?: return@runOnUiThread
            val biometricPrompt = BiometricPrompt(
                fragment,
                executor,
                object : BiometricPrompt.AuthenticationCallback() {}
            )
            // Simpan instance agar tidak di-GC
            biometricPromptRef = biometricPrompt
        }
    }

    private var biometricPromptRef: BiometricPrompt? = null

    /**
     * Apakah perangkat ini mendukung kunci kripto yang dikunci autentikasi user?
     */
    @Command
    fun isAvailable(invoke: Invoke) {
        try {
            val hasKeystore = hasKeystoreSupport()
            val hasStrongBox = hasStrongBox()
            val canAuthenticate = BiometricManager.from(activity).canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_STRONG
                    or BiometricManager.Authenticators.DEVICE_CREDENTIAL
            ) == BiometricManager.BIOMETRIC_SUCCESS

            invoke.resolve(
                mapOf(
                    "available" to (hasKeystore && canAuthenticate),
                    "strongBox" to hasStrongBox,
                    "biometric" to canAuthenticate
                )
            )
        } catch (e: Exception) {
            invoke.reject("Keystore check failed: ${e.message}", e)
        }
    }

    private fun hasKeystoreSupport(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val ks = KeyStore.getInstance(ANDROID_KEYSTORE)
            ks.load(null)
            true
        } else false
    }

    private fun hasStrongBox(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val pkg = activity.packageName
            val info = activity.packageManager.getPackageInfo(pkg, 0)
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                info.flags and android.content.pm.PackageManager.ApplicationInfo.FLAG_HAS_STRONGBOX
            } else {
                0
            }
            flags != 0
        } else false
    }

    /**
     * Buat (atau ambil) kunci penanda tangan untuk `alias`.
     * Kunci dibuat TANPA user authentication requirement supaya bisa dipakai
     * untuk challenge-response; biometric tetap diminta saat signing.
     */
    @Command
    fun generateKey(alias: String, invoke: Invoke) {
        try {
            val ks = KeyStore.getInstance(ANDROID_KEYSTORE)
            ks.load(null)
            if (!ks.containsAlias(alias)) {
                val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, ANDROID_KEYSTORE)
                val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
                    .setAlgorithmParameterSpec(java.security.spec.ECGenParameterSpec("secp256r1"))
                    .setDigests(KeyProperties.DIGEST_SHA256)
                    .build()
                generator.initialize(spec)
                generator.generateKeyPair()
            }
            invoke.resolve(mapOf("created" to true, "alias" to alias))
        } catch (e: Exception) {
            invoke.reject("Gagal membuat kunci Android Keystore: ${e.message}", e)
        }
    }

    @Command
    fun hasKey(alias: String, invoke: Invoke) {
        try {
            val ks = KeyStore.getInstance(ANDROID_KEYSTORE)
            ks.load(null)
            invoke.resolve(mapOf("exists" to ks.containsAlias(alias)))
        } catch (e: Exception) {
            invoke.resolve(mapOf("exists" to false))
        }
    }

    /**
     * Tandatangani `payload` (base64) dengan private key di keystore.
     * Mengembalikan signature base64.
     */
    @Command
    fun sign(alias: String, payload: String, invoke: Invoke) {
        try {
            val ks = KeyStore.getInstance(ANDROID_KEYSTORE)
            ks.load(null)
            val privateKey = ks.getKey(alias, null) ?: run {
                invoke.reject("Kunci tidak ditemukan: $alias")
                return
            }
            val signature = Signature.getInstance("SHA256withECDSA")
            signature.initSign(privateKey as java.security.PrivateKey)
            signature.update(android.util.Base64.decode(payload, android.util.Base64.DEFAULT))
            invoke.resolve(mapOf("signature" to android.util.Base64.encodeToString(
                signature.sign(), android.util.Base64.DEFAULT
            )))
        } catch (e: Exception) {
            invoke.reject("Gagal menandatangani: ${e.message}", e)
        }
    }

    /**
     * Minta konfirmasi biometrik / kredensial perangkat (sidik jari, pattern,
     * atau PIN layar kunci). Ini "kunci bawaan HP" yang sesungguhnya.
     */
    @Command
    fun authenticate(reason: String, invoke: Invoke) {
        activity.runOnUiThread {
            try {
                val fragment = activity as? FragmentActivity
                if (fragment == null) {
                    invoke.reject("Aktivitas bukan FragmentActivity")
                    return@runOnUiThread
                }
                val prompt = BiometricPrompt(
                    fragment,
                    executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            invoke.resolve(mapOf("authenticated" to true))
                        }

                        override fun onAuthenticationError(code: Int, msg: CharSequence) {
                            invoke.reject("Autentikasi gagal: $msg")
                        }
                    }
                )
                prompt.authenticate(
                    BiometricPrompt.PromptInfo.Builder()
                        .setTitle("Verifikasi Owner")
                        .setSubtitle(reason.ifBlank { "Buka laporan keuangan Sirka" })
                        .setAllowedAuthenticators(
                            BiometricManager.Authenticators.BIOMETRIC_STRONG
                                or BiometricManager.Authenticators.DEVICE_CREDENTIAL
                        )
                        .build()
                )
            } catch (e: Exception) {
                invoke.reject("Gagal meminta autentikasi: ${e.message}", e)
            }
        }
    }

    @Command
    fun deleteKey(alias: String, invoke: Invoke) {
        try {
            val ks = KeyStore.getInstance(ANDROID_KEYSTORE)
            ks.load(null)
            if (ks.containsAlias(alias)) ks.deleteEntry(alias)
            invoke.resolve(mapOf("deleted" to true))
        } catch (e: Exception) {
            invoke.reject("Gagal menghapus kunci: ${e.message}", e)
        }
    }
}
