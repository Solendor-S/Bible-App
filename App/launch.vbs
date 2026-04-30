Set shell = CreateObject("WScript.Shell")
shell.Run "cmd /c cd /d ""C:\Projects\BibleApp\App"" && npm run dev", 0, False
