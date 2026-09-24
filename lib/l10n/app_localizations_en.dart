// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'ProxiedMail';

  @override
  String get proxies => 'Proxies';

  @override
  String get settings => 'Settings';

  @override
  String get refresh => 'Refresh';

  @override
  String get signOut => 'Sign out';

  @override
  String get privateAddressBook => 'Your private address book';

  @override
  String get keepInboxYours => 'Keep your inbox yours.';

  @override
  String get heroDescription =>
      'Every service gets its own address. Quiet, clear, and easy to replace.';

  @override
  String get activeProxies => 'Active proxies';

  @override
  String get availableCapacity => 'Available capacity';

  @override
  String get searchAliases => 'Search aliases';

  @override
  String get newProxy => 'New proxy';

  @override
  String get yourProxies => 'Your proxies';

  @override
  String get noProxies => 'No proxy addresses yet. Create one to get started.';

  @override
  String recipients(num count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count recipients',
      one: '1 recipient',
    );
    return '$_temp0';
  }

  @override
  String forwarded(Object count) {
    return '$count forwarded';
  }

  @override
  String verifiedRecipients(Object total, Object verified) {
    return '$verified of $total verified';
  }

  @override
  String get noRecipients => 'No recipients';

  @override
  String get trigger => 'Trigger';

  @override
  String get noTrigger => 'No trigger';

  @override
  String get forwardingRecipients => 'Forwarding recipients';

  @override
  String get enableOrDisableRecipients =>
      'Enable or disable all forwarding recipients';

  @override
  String get copyAddress => 'Copy address';

  @override
  String copied(Object address) {
    return '$address copied';
  }

  @override
  String someCouldNotEnable(Object count, Object detail) {
    return 'Some forwarding recipients could not be enabled. Forwarding is on for $count recipient(s). $detail';
  }

  @override
  String someCouldNotDisable(Object detail) {
    return 'Some forwarding recipients could not be disabled. Forwarding remains on. $detail';
  }

  @override
  String get verified => 'Verified';

  @override
  String get verificationRequired => 'Verification required';

  @override
  String get sendVerification => 'Verify';

  @override
  String verificationSent(Object address) {
    return 'Verification email sent to $address';
  }

  @override
  String verificationFailed(Object detail) {
    return 'Could not send verification email: $detail';
  }

  @override
  String get settingsPlaceholder => 'Settings';

  @override
  String get language => 'Language';

  @override
  String get english => 'English';

  @override
  String get spanish => 'Spanish';

  @override
  String get welcome => 'Welcome to ProxiedMail';

  @override
  String get createAccountTitle => 'Create your ProxiedMail account';

  @override
  String get manageAliases =>
      'Manage private aliases without exposing your inbox.';

  @override
  String get token => 'Token';

  @override
  String get enterToken => 'Enter your API token';

  @override
  String get startManaging => 'Start managing private forwarding addresses.';

  @override
  String get email => 'Email';

  @override
  String get password => 'Password';

  @override
  String get enterEmail => 'Enter your email';

  @override
  String get passwordLength => 'Use at least 8 characters';

  @override
  String get createAccount => 'Create account';

  @override
  String get signIn => 'Sign in';

  @override
  String get alreadyAccount => 'Already have an account? Sign in';

  @override
  String get needAccount => 'Need an account? Create one';

  @override
  String get accountCreated => 'Account created. Sign in to continue.';

  @override
  String get newProxyAddress => 'New proxy address';

  @override
  String get editProxy => 'Edit proxy';

  @override
  String get saveChanges => 'Save changes';

  @override
  String get alias => 'Alias';

  @override
  String get domain => 'Domain';

  @override
  String get forwardTo => 'Forward to';

  @override
  String get cancel => 'Cancel';

  @override
  String get create => 'Create';
}
