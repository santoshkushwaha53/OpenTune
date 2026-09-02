import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/player_controller.dart';
import '../widgets/license_sheet.dart';

class PlayerScreen extends ConsumerWidget {
  const PlayerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(playerControllerProvider);
    final track = controller.current;
    final item = controller.currentItem;
    final maxMs = controller.duration.inMilliseconds <= 0
        ? 1
        : controller.duration.inMilliseconds;
    final posMs = controller.position.inMilliseconds.clamp(0, maxMs);
    return Scaffold(
      appBar: AppBar(title: const Text('Now playing')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(
              Icons.album,
              size: 140,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 32),
            Text(
              track?.title ?? 'Nothing playing',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            Text(track?.artistName ?? ''),
            const SizedBox(height: 8),
            Text(
              controller.usingLocalFile
                  ? 'Playing from this device'
                  : 'Streaming from the provider URL',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            Slider(
              value: posMs.toDouble(),
              max: maxMs.toDouble(),
              onChanged: track == null
                  ? null
                  : (value) =>
                        controller.seek(Duration(milliseconds: value.round())),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(_format(controller.position)),
                Text(_format(controller.duration)),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  iconSize: 40,
                  onPressed: controller.previous,
                  icon: const Icon(Icons.skip_previous),
                ),
                IconButton(
                  iconSize: 64,
                  onPressed: controller.togglePlay,
                  icon: Icon(
                    controller.playing ? Icons.pause_circle : Icons.play_circle,
                  ),
                ),
                IconButton(
                  iconSize: 40,
                  onPressed: controller.next,
                  icon: const Icon(Icons.skip_next),
                ),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  onPressed: controller.toggleShuffle,
                  icon: Icon(
                    Icons.shuffle,
                    color: controller.shuffle
                        ? Theme.of(context).colorScheme.primary
                        : null,
                  ),
                ),
                IconButton(
                  onPressed: controller.cycleRepeat,
                  icon: Icon(
                    controller.repeat == QueueRepeatMode.one
                        ? Icons.repeat_one
                        : Icons.repeat,
                    color: controller.repeat == QueueRepeatMode.off
                        ? null
                        : Theme.of(context).colorScheme.primary,
                  ),
                ),
                TextButton(
                  onPressed: item == null
                      ? null
                      : () => showLicenseSheet(
                          context,
                          track: item.track,
                          license: item.license,
                          attribution: item.attribution,
                          licenseUrl: item.licenseUrl,
                        ),
                  child: const Text('License'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text('Queue', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            for (var i = 0; i < controller.queue.items.length; i++)
              ListTile(
                contentPadding: EdgeInsets.zero,
                selected: i == controller.queue.index,
                title: Text(controller.queue.items[i].track.title),
                subtitle: Text(
                  controller.queue.items[i].track.artistName ?? '',
                ),
                onTap: () => controller.playAt(i),
              ),
            const SizedBox(height: 16),
            Text(
              'Audio is loaded from the provider URL or a local download. OpenTune never proxies files.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

String _format(Duration value) {
  final minutes = value.inMinutes;
  final seconds = value.inSeconds.remainder(60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}
