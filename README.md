# Xoriguer Compactador

Compressor i descompressor d'arxius **gratuït, sense anuncis i sense Internet**, per a Android, iPhone/iPad i ordinador.
En català, castellà, francès i anglès.

- **Obre:** 7Z, ZIP, RAR/RAR5, TAR, GZ, BZ2, XZ, ZST, ISO, CAB, DMG, WIM, LZH, ARJ, CPIO, RPM, DEB, MSI, VHD… (amb contrasenya i en diverses parts).
- **Crea:** 7Z, ZIP, TAR, TAR.GZ, TAR.XZ, TAR.BZ2, WIM, GZ, BZ2, XZ, amb contrasenya AES-256 i dividit en parts.
- Navega per dins de l'arxiu, cerca, vista prèvia (imatges, text, vídeo, àudio, PDF), extreu una selecció, prova la integritat, converteix a un altre format i obre arxius de dins d'arxius.

Motor: [7-Zip](https://www.7-zip.org/) 24.09 © Igor Pavlov (LGPL + restricció unRAR), compilat a WebAssembly ([7z-wasm](https://www.npmjs.com/package/7z-wasm)).

## Instal·lar
- **Android:** `XoriguerCompactador.apk`, o Chrome → ⋮ → Instal·la l'aplicació.
- **iPhone/iPad:** Safari → Comparteix → Afegeix a la pantalla d'inici.
- **Ordinador:** Chrome o Edge → icona ⊕ de la barra d'adreces → Instal·la.

## Desenvolupament
```bash
npm install
npm run serve      # http://localhost:8797
npm run apk        # XoriguerCompactador.apk
npm run icons      # regenera les icones
```
