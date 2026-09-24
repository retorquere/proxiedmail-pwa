import 'package:web/web.dart' as web;

void redirectToLogin() => web.window.location.replace('/');

void downloadTextFile(String fileName, String content) {
	final link = web.document.createElement('a') as web.HTMLAnchorElement
		..href = 'data:application/json;charset=utf-8,${Uri.encodeComponent(content)}'
		..download = fileName;
	link.click();
}
