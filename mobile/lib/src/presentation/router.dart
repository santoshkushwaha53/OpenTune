import 'package:go_router/go_router.dart';

import '../data/session_store.dart';
import 'screens/artist_album_screens.dart';
import 'screens/catalog_sources_screen.dart';
import 'screens/discover_screen.dart';
import 'screens/downloads_screen.dart';
import 'screens/home_screen.dart';
import 'screens/library_screen.dart';
import 'screens/login_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/player_screen.dart';
import 'screens/playlist_screens.dart';
import 'screens/track_screen.dart';
import 'shell.dart';

final appRouter = GoRouter(
  initialLocation: '/home',
  refreshListenable: onboardingGate,
  redirect: (context, state) {
    final path = state.uri.path;
    final onboarding = path.startsWith('/onboarding');
    if (onboardingGate.loggedIn &&
        !onboardingGate.onboardingCompleted &&
        !onboarding) {
      return '/onboarding';
    }
    if (onboardingGate.loggedIn &&
        onboardingGate.onboardingCompleted &&
        onboarding) {
      return '/home';
    }
    return null;
  },
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) =>
          AppShell(navigationShell: navigationShell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/home',
              builder: (context, state) => const HomeScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/discover',
              builder: (context, state) => const DiscoverScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/library',
              builder: (context, state) => const LibraryScreen(),
            ),
          ],
        ),
      ],
    ),
    GoRoute(path: '/player', builder: (context, state) => const PlayerScreen()),
    GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => const OnboardingScreen(),
    ),
    GoRoute(
      path: '/settings/music-preferences',
      builder: (context, state) => const OnboardingScreen(settingsMode: true),
    ),
    GoRoute(
      path: '/downloads',
      builder: (context, state) => const DownloadsScreen(),
    ),
    GoRoute(
      path: '/playlists',
      builder: (context, state) => const PlaylistsScreen(),
    ),
    GoRoute(
      path: '/favorites',
      builder: (context, state) => const FavoritesScreen(),
    ),
    GoRoute(
      path: '/playlist/:id',
      builder: (context, state) =>
          PlaylistDetailScreen(playlistId: state.pathParameters['id']!),
    ),
    GoRoute(
      path: '/playlists/shared/:token',
      builder: (context, state) =>
          SharedPlaylistScreen(token: state.pathParameters['token']!),
    ),
    GoRoute(
      path: '/track/:id',
      builder: (context, state) =>
          TrackScreen(trackId: state.pathParameters['id']!),
    ),
    GoRoute(
      path: '/artist/:id',
      builder: (context, state) =>
          ArtistScreen(artistId: state.pathParameters['id']!),
    ),
    GoRoute(
      path: '/album/:id',
      builder: (context, state) =>
          AlbumScreen(albumId: state.pathParameters['id']!),
    ),
    GoRoute(
      path: '/catalog-sources',
      builder: (context, state) => const CatalogSourcesScreen(),
    ),
  ],
);
