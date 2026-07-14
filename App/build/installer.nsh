; Custom NSIS include for the Bible Study Windows installer.
; During install, offer to install Ollama (the local AI backend for the AI Scholar).
; The prompt defaults to "No" — it's opt-in only. The app works fully without it and can
; also install it later from inside the app, so any failure here is non-fatal.
;
; Uses the `customInstall` hook (always fires) + a MessageBox rather than a custom nsDialogs
; page, which depends on electron-builder page-insertion internals that aren't reliable here.

!macro customInstall
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Install the optional AI Scholar now?$\r$\n$\r$\nThe AI Scholar answers questions about scripture and the Church Fathers using a local Ollama model (nothing is sent to the internet). It is a large download.$\r$\n$\r$\nChoose No to skip — you can install it later from inside the app." IDYES ollamaYes IDNO ollamaSkip

  ollamaYes:
    DetailPrint "Downloading Ollama installer..."
    ; PowerShell ships with Windows 10/11 — avoids depending on NSIS download plugins.
    ; $TEMP is an NSIS constant (expanded before PowerShell runs); no PowerShell $-vars are
    ; used here so nothing collides with NSIS variable syntax.
    nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri https://ollama.com/download/OllamaSetup.exe -OutFile \"$TEMP\OllamaSetup.exe\" -UseBasicParsing } catch { exit 1 }"'
    Pop $0
    StrCmp $0 "0" 0 ollamaFailed
    DetailPrint "Running Ollama installer..."
    ExecWait '"$TEMP\OllamaSetup.exe"'
    Goto ollamaSkip
  ollamaFailed:
    DetailPrint "Ollama download failed — you can install it later from https://ollama.com"

  ollamaSkip:
!macroend
