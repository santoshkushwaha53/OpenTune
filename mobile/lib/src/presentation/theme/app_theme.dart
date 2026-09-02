import 'package:flutter/material.dart';

import 'tokens.dart';

class AppTheme {
  static ThemeData dark() {
    final scheme =
        ColorScheme.fromSeed(
          seedColor: OpenTuneTokens.seed,
          brightness: Brightness.dark,
          surface: OpenTuneTokens.surface,
        ).copyWith(
          primary: OpenTuneTokens.seed,
          secondary: OpenTuneTokens.glow,
          surfaceContainerHighest: OpenTuneTokens.surfaceHigh,
        );

    final text = ThemeData(brightness: Brightness.dark, useMaterial3: true)
        .textTheme
        .apply(bodyColor: scheme.onSurface, displayColor: scheme.onSurface);

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: scheme,
      scaffoldBackgroundColor: OpenTuneTokens.night,
      textTheme: text.copyWith(
        headlineLarge: text.headlineLarge?.copyWith(
          fontWeight: FontWeight.w600,
          letterSpacing: -0.6,
        ),
        headlineMedium: text.headlineMedium?.copyWith(
          fontWeight: FontWeight.w600,
        ),
        titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w600),
      ),
      appBarTheme: const AppBarTheme(
        centerTitle: false,
        scrolledUnderElevation: 0,
        backgroundColor: OpenTuneTokens.night,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: OpenTuneTokens.surface.withValues(alpha: 0.92),
        indicatorColor: scheme.primary.withValues(alpha: 0.24),
        height: 68,
        labelTextStyle: WidgetStatePropertyAll(
          text.labelMedium?.copyWith(fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: OpenTuneTokens.surfaceHigh,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(OpenTuneTokens.radius),
          borderSide: BorderSide.none,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(OpenTuneTokens.radiusSm),
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: OpenTuneTokens.surfaceHigh,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(OpenTuneTokens.radiusSm),
        ),
      ),
      listTileTheme: const ListTileThemeData(iconColor: OpenTuneTokens.seed),
    );
  }
}
