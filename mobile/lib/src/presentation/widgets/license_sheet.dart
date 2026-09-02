import 'package:flutter/material.dart';

import '../../domain/track.dart';

Future<void> showLicenseSheet(
  BuildContext context, {
  required TrackSummary track,
  String? license,
  String? attribution,
  String? licenseUrl,
}) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) {
      final spdx = license ?? track.spdxId ?? 'Unknown license';
      return Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('License', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 12),
            Text(track.title, style: Theme.of(context).textTheme.titleMedium),
            Text(track.artistName ?? ''),
            const SizedBox(height: 12),
            Text(spdx),
            if (attribution != null && attribution.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(attribution),
            ],
            if (licenseUrl != null && licenseUrl.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(licenseUrl, style: Theme.of(context).textTheme.bodySmall),
            ],
            const SizedBox(height: 16),
            Text(
              'OpenTune does not host or proxy this audio. The file is loaded from the original provider URL (or a file already on this device).',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      );
    },
  );
}
