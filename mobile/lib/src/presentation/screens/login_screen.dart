import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/session_store.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  final username = TextEditingController();
  final displayName = TextEditingController();
  String? error;
  bool register = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(register ? 'Create account' : 'Account')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: ListView(
          children: [
            TextField(
              controller: email,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
            ),
            TextField(
              controller: password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Password'),
            ),
            if (register) ...[
              TextField(
                controller: username,
                decoration: const InputDecoration(labelText: 'Username'),
              ),
              TextField(
                controller: displayName,
                decoration: const InputDecoration(labelText: 'Display name'),
              ),
            ],
            if (error != null)
              Text(
                error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () async {
                try {
                  if (register) {
                    await ref
                        .read(sessionStoreProvider)
                        .register(
                          email: email.text.trim(),
                          username: username.text.trim(),
                          password: password.text,
                          displayName: displayName.text.trim(),
                        );
                  } else {
                    await ref
                        .read(sessionStoreProvider)
                        .login(email.text.trim(), password.text);
                  }
                  if (context.mounted) Navigator.of(context).pop();
                } catch (_) {
                  setState(
                    () => error =
                        'Could not authenticate. Check the API and credentials.',
                  );
                }
              },
              child: Text(register ? 'Register' : 'Sign in'),
            ),
            TextButton(
              onPressed: () => setState(() => register = !register),
              child: Text(
                register
                    ? 'Have an account? Sign in'
                    : 'Need an account? Register',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
