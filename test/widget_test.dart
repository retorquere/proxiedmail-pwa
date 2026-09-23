import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:proxiedmail_dashboard/main.dart';

void main() {
  testWidgets('starts with session restoration', (WidgetTester tester) async {
    await tester.pumpWidget(const ProxiedMailApp());

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
