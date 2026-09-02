import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_client.dart';

final sessionStoreProvider = ChangeNotifierProvider<SessionStore>((ref) {
  final store = SessionStore(ref.read(apiClientProvider));
  store.refresh();
  return store;
});

class SessionStore extends ChangeNotifier {
  SessionStore(this._api);

  final ApiClient _api;
  bool loggedIn = false;

  Future<void> refresh() async {
    loggedIn = await _api.hasSession();
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    await _api.login(email, password);
    loggedIn = true;
    notifyListeners();
  }

  Future<void> register({
    required String email,
    required String username,
    required String password,
    required String displayName,
  }) async {
    await _api.register(
      email: email,
      username: username,
      password: password,
      displayName: displayName,
    );
    loggedIn = true;
    notifyListeners();
  }

  Future<void> logout() async {
    await _api.logout();
    loggedIn = false;
    notifyListeners();
  }
}
