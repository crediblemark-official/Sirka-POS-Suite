!macro NSIS_HOOK_PREINSTALL
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Pasang sertifikat digital Sirka ke Trusted Root Certification Authorities secara otomatis
  nsExec::Exec 'certutil -addstore -f "Root" "$INSTDIR\certs\Sirka_CodeSigning.cer"'
  nsExec::Exec 'certutil -user -addstore -f "Root" "$INSTDIR\certs\Sirka_CodeSigning.cer"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
