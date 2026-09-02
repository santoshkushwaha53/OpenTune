import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';

import '../../application/player_controller.dart';
import '../widgets/license_sheet.dart';

class PlayerScreen extends ConsumerStatefulWidget {
  const PlayerScreen({super.key});

  @override
  ConsumerState<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends ConsumerState<PlayerScreen>
    implements YoutubePlaybackHost {
  YoutubePlayerController? _youtube;
  StreamSubscription<YoutubePlayerValue>? _youtubeValues;
  StreamSubscription<YoutubeVideoState>? _youtubeProgress;
  var _endedHandled = false;
  PlayerController? _player;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      _player = ref.read(playerControllerProvider);
      _player!.youtubeHost = this;
    });
  }

  @override
  void dispose() {
    if (_player?.youtubeHost == this) {
      _player!.youtubeHost = null;
    }
    _youtubeValues?.cancel();
    _youtubeProgress?.cancel();
    _youtube?.close();
    super.dispose();
  }

  @override
  Future<void> load(String videoId) async {
    _endedHandled = false;
    if (_youtube == null) {
      final controller = YoutubePlayerController(
        params: const YoutubePlayerParams(
          mute: false,
          showFullscreenButton: true,
          strictRelatedVideos: true,
        ),
      );
      _bindYoutube(controller);
      _youtube = controller;
      if (mounted) {
        setState(() {});
      }
    }
    await _youtube!.loadVideoById(videoId: videoId);
  }

  void _bindYoutube(YoutubePlayerController controller) {
    _youtubeValues?.cancel();
    _youtubeProgress?.cancel();
    _youtubeValues = controller.listen((value) {
      final player = ref.read(playerControllerProvider);
      if (value.playerState == PlayerState.ended && !_endedHandled) {
        _endedHandled = true;
        player.next();
        return;
      }
      if (value.playerState == PlayerState.playing) {
        _endedHandled = false;
        player.syncEngine(
          playing: true,
          duration: value.metaData.duration == Duration.zero
              ? null
              : value.metaData.duration,
        );
      } else if (value.playerState == PlayerState.paused) {
        player.syncEngine(playing: false);
      }
    });
    _youtubeProgress = controller.videoStateStream.listen((state) {
      final player = ref.read(playerControllerProvider);
      final trackDuration = player.current?.durationMs ?? 0;
      player.syncEngine(
        position: state.position,
        duration: trackDuration > 0
            ? Duration(milliseconds: trackDuration)
            : player.duration,
      );
    });
  }

  @override
  Future<void> play() => _youtube?.playVideo() ?? Future.value();

  @override
  Future<void> pause() => _youtube?.pauseVideo() ?? Future.value();

  @override
  Future<void> seek(Duration position) =>
      _youtube?.seekTo(
        seconds: position.inMilliseconds / 1000,
        allowSeekAhead: true,
      ) ??
      Future.value();

  @override
  Future<void> stop() => _youtube?.stopVideo() ?? Future.value();

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(playerControllerProvider);
    final track = controller.current;
    final item = controller.currentItem;
    final maxMs = controller.duration.inMilliseconds <= 0
        ? 1
        : controller.duration.inMilliseconds;
    final posMs = controller.position.inMilliseconds.clamp(0, maxMs);
    final youtube = _youtube;
    return Scaffold(
      appBar: AppBar(title: const Text('Now playing')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (controller.isYoutube && youtube != null)
              YoutubePlayer(controller: youtube, aspectRatio: 16 / 9)
            else
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
              controller.isYoutube
                  ? 'Streaming in YouTube’s player. Download is not available.'
                  : controller.usingLocalFile
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
              'YouTube plays in YouTube’s official player. Other catalogs stream from the provider URL. OpenTune never proxies files.',
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
