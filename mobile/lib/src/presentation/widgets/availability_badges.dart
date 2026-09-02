import 'package:flutter/material.dart';

import '../../domain/track.dart';

/// Stream / download / offline / unavailable / attribution — always visible on catalog rows.
class AvailabilityBadges extends StatelessWidget {
  const AvailabilityBadges({
    super.key,
    required this.track,
    this.offline = false,
  });

  final TrackSummary track;
  final bool offline;

  @override
  Widget build(BuildContext context) {
    final unavailable = !track.stream && !track.download;
    final chips = <Widget>[
      if (offline) const _Badge('Available offline', Icons.check_circle),
      if (track.stream) const _Badge('Stream', Icons.play_arrow),
      if (track.download) const _Badge('Download', Icons.download),
      if (!track.download && track.stream)
        const _Badge('Download unavailable', Icons.block),
      if (unavailable) const _Badge('Unavailable', Icons.hide_source),
      if (track.attributionRequired)
        const _Badge('Attribution required', Icons.warning_amber),
    ];
    return Wrap(spacing: 6, runSpacing: 6, children: chips);
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.label, this.icon);

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Chip(
      visualDensity: VisualDensity.compact,
      avatar: Icon(icon, size: 16),
      label: Text(label),
    );
  }
}
