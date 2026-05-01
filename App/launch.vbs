Dim scriptDir, shell
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -NonInteractive -NoProfile -File """ & scriptDir & "\launch.ps1""", 0, False
