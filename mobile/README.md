# OpenTune (Flutter)

Dark-first music client. Clean architecture:

```
lib/src/presentation  screens, theme, navigation shell
lib/src/application   Riverpod controllers
lib/src/domain        track models
lib/src/data          Dio API client (metadata only)
```

The app talks to the OpenTune API for **metadata only**. Playback and downloads use original provider URLs (or local files after a permitted download). Downloads are stored only on this device, with cancel/delete and a license snapshot in the local index. Offline mode plays those files only and does not retry the API in a loop.

After registration, new accounts go through music personalization. The starter pack is downloaded on-device from permitted provider URLs while Home is already visible.

Primary navigation: **Home**, **Discover**, **Library**, with a mini-player above the bar. Home is artwork-first and follows now playing, listen history, and the last search. Discover is a visual scene browser; search covers songs, singers, and years. Track detail and Library rows show availability badges. Now playing streams from the provider URL, shows the queue, and opens a license sheet.

```bash
flutter pub get
flutter analyze
flutter test
flutter run
```

Default API base: `http://127.0.0.1:3000`. Android emulator: `--dart-define=API_BASE_URL=http://10.0.2.2:3000`. Production device:

```bash
flutter run -d DU6LNNFMMBOR5L4D \
  --dart-define=API_BASE_URL=https://opentune-api.onrender.com
```

Pixel goldens (availability badges, offline banner) run on macOS: `flutter test --update-goldens test/golden_test.dart`. CI runs the semantic golden checks and offline cache tests on every OS.
