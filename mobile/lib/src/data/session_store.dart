import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_client.dart';

/// Shared with GoRouter so new accounts land on onboarding without a duplicate SessionStore.
class OnboardingGate extends ChangeNotifier {
  bool loggedIn = false;
  bool onboardingCompleted = true;

  void update({required bool loggedIn, required bool onboardingCompleted}) {
    if (this.loggedIn == loggedIn &&
        this.onboardingCompleted == onboardingCompleted) {
      return;
    }
    this.loggedIn = loggedIn;
    this.onboardingCompleted = onboardingCompleted;
    notifyListeners();
  }

  void reset() {
    update(loggedIn: false, onboardingCompleted: true);
  }
}

final onboardingGate = OnboardingGate();

final sessionStoreProvider = ChangeNotifierProvider<SessionStore>((ref) {
  final store = SessionStore(ref.read(apiClientProvider));
  store.refresh();
  return store;
});

class SessionStore extends ChangeNotifier {
  SessionStore(this._api);

  final ApiClient _api;
  bool loggedIn = false;
  bool onboardingCompleted = true;
  String? displayName;

  void _publish() {
    onboardingGate.update(
      loggedIn: loggedIn,
      onboardingCompleted: onboardingCompleted,
    );
    notifyListeners();
  }

  Future<void> refresh() async {
    loggedIn = await _api.hasSession();
    if (!loggedIn) {
      onboardingCompleted = true;
      displayName = null;
      _publish();
      return;
    }
    try {
      final me = await _api.me();
      displayName = me['displayName'] as String?;
      onboardingCompleted = me['onboardingCompleted'] as bool? ?? true;
    } catch (_) {
      onboardingCompleted = true;
    }
    _publish();
  }

  Future<void> login(String email, String password) async {
    final data = await _api.login(email, password);
    await _applyAuth(data);
  }

  Future<void> register({
    required String email,
    required String username,
    required String password,
    required String displayName,
  }) async {
    final data = await _api.register(
      email: email,
      username: username,
      password: password,
      displayName: displayName,
    );
    await _applyAuth(data);
  }

  Future<void> _applyAuth(Map<String, dynamic> data) async {
    loggedIn = true;
    final user = data['user'] as Map<String, dynamic>? ?? {};
    displayName = user['displayName'] as String? ?? displayName;
    onboardingCompleted = user['onboardingCompleted'] as bool? ?? false;
    _publish();
  }

  Future<void> markOnboardingDone() async {
    onboardingCompleted = true;
    _publish();
  }

  Future<void> logout() async {
    await _api.logout();
    loggedIn = false;
    onboardingCompleted = true;
    displayName = null;
    _publish();
  }
}
