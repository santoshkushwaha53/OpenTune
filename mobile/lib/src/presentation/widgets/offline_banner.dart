import 'package:flutter/material.dart';

import '../theme/tokens.dart';

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({
    super.key,
    this.message = 'Offline mode — showing cached or local library only.',
  });

  final String message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.secondaryContainer.withValues(alpha: 0.4),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: OpenTuneTokens.spaceLg,
          vertical: OpenTuneTokens.spaceSm,
        ),
        child: Row(
          children: [
            Icon(Icons.cloud_off, size: 18, color: scheme.secondary),
            const SizedBox(width: OpenTuneTokens.spaceSm),
            Expanded(
              child: Text(
                message,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
