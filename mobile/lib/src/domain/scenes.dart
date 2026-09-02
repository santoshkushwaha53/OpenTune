import 'package:flutter/material.dart';

class MusicScene {
  const MusicScene({
    required this.slug,
    required this.name,
    required this.searchQuery,
    required this.colors,
    required this.icon,
  });

  final String slug;
  final String name;
  final String searchQuery;
  final List<Color> colors;
  final IconData icon;
}

class SceneGroup {
  const SceneGroup({required this.title, required this.scenes});

  final String title;
  final List<MusicScene> scenes;
}

class YearFilter {
  const YearFilter({required this.label, this.from, this.to});

  final String label;
  final int? from;
  final int? to;
}

const discoverYearFilters = [
  YearFilter(label: 'Any year'),
  YearFilter(label: '2024', from: 2024, to: 2024),
  YearFilter(label: '2020s', from: 2020, to: 2029),
  YearFilter(label: '2010s', from: 2010, to: 2019),
  YearFilter(label: '2000s', from: 2000, to: 2009),
];

MusicScene? sceneBySlug(String slug) {
  for (final group in discoverSceneGroups) {
    for (final scene in group.scenes) {
      if (scene.slug == slug) {
        return scene;
      }
    }
  }
  return null;
}

final discoverSceneGroups = [
  SceneGroup(
    title: 'Indian scenes',
    scenes: [
      _scene(
        'bollywood',
        'Bollywood',
        'bollywood',
        Icons.movie_outlined,
        const [Color(0xFFE11D48), Color(0xFFF59E0B)],
      ),
      _scene('indian-pop', 'Indian Pop', 'indian pop', Icons.mic_none, const [
        Color(0xFF7C3AED),
        Color(0xFFEC4899),
      ]),
      _scene(
        'devotional',
        'Devotional',
        'devotional',
        Icons.self_improvement,
        const [Color(0xFFB45309), Color(0xFFFDE68A)],
      ),
      _scene('folk', 'Folk', 'folk', Icons.spa_outlined, const [
        Color(0xFF047857),
        Color(0xFF6EE7B7),
      ]),
      _scene(
        'soundtracks',
        'Soundtracks',
        'soundtrack',
        Icons.theaters_outlined,
        const [Color(0xFF1D4ED8), Color(0xFF22D3EE)],
      ),
    ],
  ),
  SceneGroup(
    title: 'Global sounds',
    scenes: [
      _scene('indie', 'Indie', 'indie', Icons.graphic_eq, const [
        Color(0xFF6366F1),
        Color(0xFFA78BFA),
      ]),
      _scene('electronic', 'Electronic', 'electronic', Icons.memory, const [
        Color(0xFF0EA5E9),
        Color(0xFF22C55E),
      ]),
      _scene('lofi', 'Lo-fi', 'lofi', Icons.nights_stay_outlined, const [
        Color(0xFF312E81),
        Color(0xFF818CF8),
      ]),
      _scene('rock', 'Rock', 'rock', Icons.offline_bolt_outlined, const [
        Color(0xFF9F1239),
        Color(0xFFF97316),
      ]),
      _scene('hip-hop', 'Hip-Hop', 'hip hop', Icons.headphones_outlined, const [
        Color(0xFF111827),
        Color(0xFFFACC15),
      ]),
      _scene('jazz', 'Jazz', 'jazz', Icons.piano, const [
        Color(0xFF1E3A8A),
        Color(0xFFF472B6),
      ]),
      _scene('rnb', 'R&B', 'rnb soul', Icons.favorite_outline, const [
        Color(0xFF831843),
        Color(0xFFFB7185),
      ]),
      _scene('classical', 'Classical', 'classical', Icons.library_music, const [
        Color(0xFF334155),
        Color(0xFFCBD5E1),
      ]),
      _scene('ambient', 'Ambient', 'ambient', Icons.blur_on, const [
        Color(0xFF155E75),
        Color(0xFF67E8F9),
      ]),
      _scene(
        'acoustic',
        'Acoustic',
        'acoustic',
        Icons.music_note_outlined,
        const [Color(0xFF854D0E), Color(0xFFFBBF24)],
      ),
      _scene('instrumental', 'Instrumental', 'instrumental', Icons.tune, const [
        Color(0xFF0F766E),
        Color(0xFF5EEAD4),
      ]),
      _scene('world', 'World', 'world', Icons.public, const [
        Color(0xFF1D4ED8),
        Color(0xFF34D399),
      ]),
    ],
  ),
  SceneGroup(
    title: 'Languages & voices',
    scenes: [
      _scene(
        'lang-hi',
        'Hindi',
        'hindi',
        Icons.record_voice_over_outlined,
        const [Color(0xFFC2410C), Color(0xFFFBBF24)],
      ),
      _scene(
        'lang-ta',
        'Tamil',
        'tamil',
        Icons.record_voice_over_outlined,
        const [Color(0xFFB91C1C), Color(0xFFFB7185)],
      ),
      _scene(
        'lang-te',
        'Telugu',
        'telugu',
        Icons.record_voice_over_outlined,
        const [Color(0xFF7C2D12), Color(0xFFFDBA74)],
      ),
      _scene(
        'lang-en',
        'English',
        'english vocal',
        Icons.record_voice_over,
        const [Color(0xFF1E40AF), Color(0xFF93C5FD)],
      ),
      _scene(
        'lang-ko',
        'Korean',
        'korean',
        Icons.record_voice_over_outlined,
        const [Color(0xFF4C1D95), Color(0xFFF9A8D4)],
      ),
      _scene('lang-ja', 'Japanese', 'japanese', Icons.record_voice_over, const [
        Color(0xFF9D174D),
        Color(0xFFFBCFE8),
      ]),
      _scene('lang-es', 'Spanish', 'spanish', Icons.record_voice_over, const [
        Color(0xFFB45309),
        Color(0xFFFDDA63),
      ]),
    ],
  ),
  SceneGroup(
    title: 'Moods',
    scenes: [
      _scene('focus', 'Focus', 'focus', Icons.center_focus_strong, const [
        Color(0xFF164E63),
        Color(0xFF22D3EE),
      ]),
      _scene('workout', 'Workout', 'workout', Icons.fitness_center, const [
        Color(0xFF9A3412),
        Color(0xFFF97316),
      ]),
      _scene('relax', 'Relax', 'relax', Icons.waves, const [
        Color(0xFF1E3A8A),
        Color(0xFF67E8F9),
      ]),
      _scene('party', 'Party', 'party', Icons.celebration_outlined, const [
        Color(0xFF6D28D9),
        Color(0xFFFB7185),
      ]),
      _scene('romantic', 'Romantic', 'romantic', Icons.favorite, const [
        Color(0xFF9F1239),
        Color(0xFFFDA4AF),
      ]),
      _scene('late-night', 'Late Night', 'night', Icons.dark_mode, const [
        Color(0xFF0F172A),
        Color(0xFF818CF8),
      ]),
    ],
  ),
];

MusicScene _scene(
  String slug,
  String name,
  String query,
  IconData icon,
  List<Color> colors,
) {
  return MusicScene(
    slug: slug,
    name: name,
    searchQuery: query,
    colors: colors,
    icon: icon,
  );
}
