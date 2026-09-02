import 'package:flutter/material.dart';

import 'router.dart';
import 'theme/app_theme.dart';

class OpenTuneApp extends StatelessWidget {
  const OpenTuneApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'OpenTune',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark(),
      routerConfig: appRouter,
    );
  }
}
