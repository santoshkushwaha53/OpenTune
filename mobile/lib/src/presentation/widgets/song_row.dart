import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/player_controller.dart';
import '../../data/api_client.dart';
import '../../data/download_store.dart';
import '../../domain/track.dart';
import '../theme/tokens.dart';
import 'cover_art.dart';

class SongRow extends ConsumerWidget {
  const SongRow({
    super.key,
    required this.index,
    required this.track,
    this.mix = const [],
  });

  final int index;
  final TrackSummary track;
  final List<TrackSummary> mix;

  Future<void> _play(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(playerControllerProvider).playMix(track: track, mix: mix);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not play this song')),
        );
      }
    }
  }

  Future<void> _download(BuildContext context, WidgetRef ref) async {
    final downloads = ref.read(downloadStoreProvider);
    if (downloads.isOffline(track.id)) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Already on this device')));
      return;
    }
    if (!track.download) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('This song is listen-only')));
      return;
    }
    try {
      final url = await ref.read(apiClientProvider).downloadSourceUrl(track.id);
      if (url == null) {
        throw DownloadRejected('This song is listen-only');
      }
      await downloads.enqueue(
        trackId: track.id,
        title: track.title,
        url: url,
        license: track.spdxId,
        artistName: track.artistName,
        artworkUrl: track.artworkUrl,
        durationMs: track.durationMs,
      );
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Saved on this device')));
      }
    } on DownloadRejected catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              error.message.contains('stream-only') ||
                      error.message.contains('listen-only')
                  ? 'This song is listen-only'
                  : 'Could not save this song',
            ),
          ),
        );
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save this song')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final downloads = ref.watch(downloadStoreProvider);
    final saved = downloads.isOffline(track.id);
    final record = downloads.items[track.id];
    final downloading = record?.state == DownloadState.downloading;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 36,
            child: Text(
              index.toString().padLeft(2, '0'),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: OpenTuneTokens.teal,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          CoverArt(url: track.artworkUrl, size: 52, radius: 12),
          const SizedBox(width: 12),
          Expanded(
            child: InkWell(
              onTap: () => _play(context, ref),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    track.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    [
                      track.artistName ?? 'Unknown artist',
                      if (track.year != null) '${track.year}',
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: Colors.white70),
                  ),
                ],
              ),
            ),
          ),
          IconButton(
            tooltip: 'Play',
            onPressed: () => _play(context, ref),
            icon: const Icon(Icons.play_arrow_rounded),
          ),
          if (downloading)
            SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                strokeWidth: 2.4,
                value: (record?.progress ?? 0) <= 0
                    ? null
                    : record!.progress.clamp(0, 1),
              ),
            )
          else
            IconButton(
              tooltip: saved
                  ? 'Saved'
                  : track.download
                  ? 'Download'
                  : 'Listen only',
              onPressed: saved || !track.download
                  ? null
                  : () => _download(context, ref),
              icon: Icon(
                saved ? Icons.download_done : Icons.download_rounded,
                color: saved ? OpenTuneTokens.teal : null,
              ),
            ),
        ],
      ),
    );
  }
}
