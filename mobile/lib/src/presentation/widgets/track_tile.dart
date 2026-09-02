import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/download_store.dart';
import '../../domain/track.dart';
import 'availability_badges.dart';

class TrackTile extends ConsumerWidget {
  const TrackTile({super.key, required this.track});

  final TrackSummary track;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offline = ref.watch(downloadStoreProvider).isOffline(track.id);
    return ListTile(
      leading: _Art(url: track.artworkUrl),
      title: Text(track.title),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(track.artistName ?? 'Unknown artist'),
          const SizedBox(height: 4),
          AvailabilityBadges(track: track, offline: offline),
        ],
      ),
      isThreeLine: true,
      onTap: () => context.push('/track/${track.id}'),
    );
  }
}

class _Art extends StatelessWidget {
  const _Art({this.url});
  final String? url;

  @override
  Widget build(BuildContext context) {
    if (url == null || url!.isEmpty) {
      return const Icon(Icons.album, size: 48);
    }
    final local = url!.startsWith('/') || url!.startsWith('file:');
    if (local) {
      final file = File(url!.replaceFirst('file://', ''));
      if (file.existsSync()) {
        return ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.file(file, width: 48, height: 48, fit: BoxFit.cover),
        );
      }
      return const Icon(Icons.album, size: 48);
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: CachedNetworkImage(
        imageUrl: url!,
        width: 48,
        height: 48,
        fit: BoxFit.cover,
      ),
    );
  }
}
