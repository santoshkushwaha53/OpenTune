import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:opentune/src/data/api_client.dart';
import 'package:opentune/src/data/catalog_cache.dart';
import 'package:opentune/src/data/offline_store.dart';

void main() {
  late Directory dir;

  setUp(() {
    dir = Directory.systemTemp.createTempSync('opentune-cache');
  });

  tearDown(() {
    if (dir.existsSync()) {
      dir.deleteSync(recursive: true);
    }
  });

  test(
    'offline home reads the catalog cache and does not retry the API',
    () async {
      final cache = CatalogCache(root: dir);
      await cache.writeHome({
        'greeting': 'Discover open music',
        'recommended': [
          {
            'id': '11111111-1111-1111-1111-111111111111',
            'title': 'Open Horizon',
          },
        ],
      });

      var requests = 0;
      final dio = Dio(BaseOptions(baseUrl: 'http://127.0.0.1:9'));
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests += 1;
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.connectionError,
              ),
            );
          },
        ),
      );

      final offline = OfflineStore(offline: true);
      final api = ApiClient(dio: dio, cache: cache, offline: offline);
      final home = await api.home();

      expect(requests, 0);
      expect(home['offline'], isTrue);
      expect(home['greeting'], 'Discover open music');
      expect((home['recommended'] as List).single['title'], 'Open Horizon');
    },
  );

  test('a failed home call enters offline and serves the last cache', () async {
    final cache = CatalogCache(root: dir);
    await cache.writeHome({
      'greeting': 'Discover open music',
      'recommended': <dynamic>[],
    });

    var requests = 0;
    final dio = Dio(
      BaseOptions(
        baseUrl: 'http://127.0.0.1:9',
        connectTimeout: const Duration(milliseconds: 50),
      ),
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests += 1;
          handler.reject(
            DioException(
              requestOptions: options,
              type: DioExceptionType.connectionError,
            ),
          );
        },
      ),
    );

    final offline = OfflineStore();
    final api = ApiClient(dio: dio, cache: cache, offline: offline);
    final home = await api.home();

    expect(requests, 1);
    expect(offline.offline, isTrue);
    expect(home['offline'], isTrue);

    await api.home();
    expect(requests, 1);
  });
}
