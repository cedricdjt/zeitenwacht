# Zeitenwacht

Tower Defense im Browser in 3D: sechs Zeitalter von der Steinzeit bis zur nahen Zukunft, 60 Wellen, Ausbauzweige, Super- und Megawaffen, Zeitgaben.

## Spielen

Das Spiel läuft ohne Build-Schritt (ES-Module, three.js liegt in `vendor/` bei). Es braucht nur einen kleinen Webserver, weil Browser ES-Module nicht direkt von der Festplatte laden:

```sh
./start.sh            # oder: python3 tools/serve.py
```

Danach die angezeigte Adresse im Browser öffnen.

## Entwickeln

Node.js wird nur für Typprüfung, Tests und den Einzeldatei-Build gebraucht:

```sh
npm install
npm run check         # Typprüfung
npm test              # Tests
npm run build         # dist/zeitenwacht.html, per Doppelklick spielbar
```

Wegweiser: `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/SIM.md`, `docs/STATUS.md`.
