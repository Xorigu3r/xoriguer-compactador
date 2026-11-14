; Última pàgina de l'instal·lador: casella "Crea un accés directe a l'escriptori" (marcada).
!ifndef BUILD_UNINSTALLER
  !define MUI_FINISHPAGE_SHOWREADME
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Crea un accés directe a l'escriptori"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION CompactadorDesktopShortcut
  Function CompactadorDesktopShortcut
    CreateShortCut "$DESKTOP\Xoriguer Compactador.lnk" "$INSTDIR\Xoriguer Compactador.exe" "" "$INSTDIR\Xoriguer Compactador.exe" 0
  FunctionEnd
!endif

!macro customUnInstall
  Delete "$DESKTOP\Xoriguer Compactador.lnk"
!macroend
