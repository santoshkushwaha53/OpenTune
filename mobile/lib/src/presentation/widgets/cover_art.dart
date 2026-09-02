import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../theme/tokens.dart';

class CoverArt extends StatelessWidget {
  const CoverArt({
    super.key,
    this.url,
    this.size = 48,
    this.radius = 12,
    this.hero = false,
  });

  final String? url;
  final double size;
  final double radius;
  final bool hero;

  @override
  Widget build(BuildContext context) {
    final placeholder = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [OpenTuneTokens.violet, OpenTuneTokens.teal],
        ),
      ),
      child: Icon(
        Icons.graphic_eq,
        color: Colors.white.withValues(alpha: 0.85),
        size: size * 0.38,
      ),
    );
    Widget fill(Widget child) => SizedBox.expand(child: child);
    Widget child;
    if (url == null || url!.isEmpty) {
      child = fill(placeholder);
    } else if (url!.startsWith('/') || url!.startsWith('file:')) {
      final file = File(url!.replaceFirst('file://', ''));
      child = file.existsSync()
          ? fill(Image.file(file, fit: BoxFit.cover, width: size, height: size))
          : fill(placeholder);
    } else {
      child = CachedNetworkImage(
        imageUrl: url!,
        fit: BoxFit.cover,
        width: hero ? double.infinity : size,
        height: size,
        placeholder: (_, _) => fill(placeholder),
        errorWidget: (_, _, _) => fill(placeholder),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        width: hero ? double.infinity : size,
        height: size,
        child: child,
      ),
    );
  }
}
