//! Koneksi PostgreSQL dengan dukungan TLS (rustls).
//!
//! BUG FIX (keamanan): sebelumnya seluruh koneksi PostgreSQL memakai
//! `NoTls`, artinya password database dan seluruh data keuangan melintas
//! internet **tanpa enkripsi** dan mudah di-sniff.
//!
//! Strategi di sini:
//! 1. Bila connection string memuat `sslmode=disable` → koneksi polos
//!    (sesuai permintaan eksplisit pengguna).
//! 2. Bila `sslmode=require|prefer|verify-ca|verify-full` → WAJIB TLS.
//! 3. Bila `sslmode` tidak disebut → coba TLS lebih dulu; bila gagal
//!    (mis. provider belum mengaktifkan SSL), fall back ke koneksi polos
//!    **dengan peringatan** supaya aplikasi tetap bisa dipakai.
//!
//! `rustls` dipilih (bukan `native-tls`) karena murni Rust — tidak
//! memerlukan OpenSSL dev headers pada mesin build.

use std::future::Future;
use std::io;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};

use rustls::ClientConfig;
use rustls_pki_types::ServerName;
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio_postgres::tls::{ChannelBinding, MakeTlsConnect, TlsConnect};
use tokio_rustls::TlsConnector;
use tokio_rustls::client::TlsStream as RustlsTlsStream;

/// Wrapper stream TLS yang memenuhi trait `tokio_postgres::tls::TlsStream`.
///
/// Diperlukan karena trait postgres meminta implementasi `channel_binding()`
/// sendiri, dan stream-nya harus `Unpin`.
pub struct PostgresTlsStream<S> {
    inner: RustlsTlsStream<S>,
}

impl<S> PostgresTlsStream<S>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    fn new(inner: RustlsTlsStream<S>) -> Self {
        Self { inner }
    }
}

impl<S> tokio_postgres::tls::TlsStream for PostgresTlsStream<S>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    fn channel_binding(&self) -> ChannelBinding {
        // PostgreSQL tidak mewajibkan channel binding untuk enkripsi TLS
        // biasa (hanya dipakai untuk SCRAM dengan kanal tambahan).
        ChannelBinding::none()
    }
}

impl<S> AsyncRead for PostgresTlsStream<S>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        Pin::new(&mut self.get_mut().inner).poll_read(cx, buf)
    }
}

impl<S> AsyncWrite for PostgresTlsStream<S>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    fn poll_write(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        Pin::new(&mut self.get_mut().inner).poll_write(cx, buf)
    }

    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.get_mut().inner).poll_flush(cx)
    }

    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.get_mut().inner).poll_shutdown(cx)
    }
}

/// Connector TLS berbasis rustls.
#[derive(Clone)]
pub struct RustlsConnect {
    connector: TlsConnector,
    domain: String,
}

impl<S> MakeTlsConnect<S> for RustlsConnect
where
    S: AsyncRead + AsyncWrite + Unpin + Send + Sync + 'static,
{
    type Stream = PostgresTlsStream<S>;
    type TlsConnect = RustlsConnect;
    type Error = io::Error;

    fn make_tls_connect(&mut self, domain: &str) -> Result<Self::TlsConnect, Self::Error> {
        Ok(RustlsConnect {
            connector: self.connector.clone(),
            domain: domain.to_string(),
        })
    }
}

impl<S> TlsConnect<S> for RustlsConnect
where
    S: AsyncRead + AsyncWrite + Unpin + Send + Sync + 'static,
{
    type Stream = PostgresTlsStream<S>;
    type Error = io::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Stream, Self::Error>> + Send>>;

    fn connect(self, stream: S) -> Self::Future {
        let domain = self.domain.clone();
        Box::pin(async move {
            let server_name = ServerName::try_from(domain.clone()).map_err(|e| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("Nama host server PostgreSQL tidak valid untuk TLS: {}", e),
                )
            })?;
            let tls = self.connector.connect(server_name, stream).await?;
            Ok(PostgresTlsStream::new(tls))
        })
    }
}

/// Bangun `ClientConfig` rustls memakai CA store sistem, dengan fallback ke
/// CA bawaan Mozilla bila sistem tidak punya certificate store.
fn build_client_config() -> Result<ClientConfig, String> {
    let mut roots = rustls::RootCertStore::empty();
    let mut loaded = false;

    // 1) CA store sistem
    let result = rustls_native_certs::load_native_certs();
    for cert in result.certs {
        if roots.add(cert).is_ok() {
            loaded = true;
        }
    }
    if !result.errors.is_empty() {
        eprintln!(
            "[TLS] {} error saat memuat CA store sistem (diabaikan)",
            result.errors.len()
        );
    }

    // 2) Cadangan: CA bawaan Mozilla
    if !loaded {
        roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        loaded = true;
    }

    if !loaded {
        return Err("Tidak ada certificate authority yang tersedia untuk TLS".to_string());
    }

    let config = ClientConfig::builder()
        .with_root_certificates(roots)
        .with_no_client_auth();

    Ok(config)
}

/// Buat connector TLS siap pakai.
pub fn make_tls_connector() -> Result<RustlsConnect, String> {
    let config = build_client_config()?;
    let connector = TlsConnector::from(Arc::new(config));
    Ok(RustlsConnect {
        connector,
        domain: String::new(),
    })
}

/// Mode SSL yang diminta oleh connection string.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SslMode {
    /// Caller tidak menyebut `sslmode` → coba TLS, boleh fallback.
    PreferTls,
    /// `sslmode=disable` → tanpa enkripsi (permintaan eksplisit).
    Disable,
    /// `sslmode=require|verify-ca|verify-full` → wajib TLS.
    Require,
}

/// Parse `sslmode` dari connection string PostgreSQL (mendukung format URL dan format key-value).
pub fn parse_ssl_mode(conn_str: &str) -> SslMode {
    if let Some(idx) = conn_str.find("sslmode=") {
        let after = &conn_str[idx + 8..];
        let val = after.split(['&', ' ', '?'].as_ref()).next().unwrap_or("").trim_matches('\'');
        return match val {
            "disable" => SslMode::Disable,
            "require" | "verify-ca" | "verify-full" => SslMode::Require,
            "prefer" | "allow" => SslMode::PreferTls,
            _ => SslMode::PreferTls,
        };
    }

    SslMode::PreferTls
}

/// Hapus parameter `sslmode` dari connection string (dikendalikan manual di sini).
pub fn strip_ssl_mode(conn_str: &str) -> String {
    if conn_str.contains("://") {
        if let Some(idx) = conn_str.find("sslmode=") {
            let prefix = &conn_str[..idx];
            let after = &conn_str[idx + 8..];
            let rest = if let Some(amp_idx) = after.find('&') {
                &after[amp_idx + 1..]
            } else {
                ""
            };
            let mut res = prefix.trim_end_matches(['?', '&'].as_ref()).to_string();
            if !rest.is_empty() {
                if res.contains('?') {
                    res.push('&');
                } else {
                    res.push('?');
                }
                res.push_str(rest);
            }
            return res;
        }
        return conn_str.to_string();
    }

    conn_str
        .split_whitespace()
        .filter(|p| !p.starts_with("sslmode="))
        .collect::<Vec<_>>()
        .join(" ")
}
