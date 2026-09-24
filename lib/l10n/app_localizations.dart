import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_es.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('es'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'ProxiedMail'**
  String get appTitle;

  /// No description provided for @proxies.
  ///
  /// In en, this message translates to:
  /// **'Proxies'**
  String get proxies;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @refresh.
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get refresh;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @privateAddressBook.
  ///
  /// In en, this message translates to:
  /// **'Your private address book'**
  String get privateAddressBook;

  /// No description provided for @keepInboxYours.
  ///
  /// In en, this message translates to:
  /// **'Keep your inbox yours.'**
  String get keepInboxYours;

  /// No description provided for @heroDescription.
  ///
  /// In en, this message translates to:
  /// **'Every service gets its own address. Quiet, clear, and easy to replace.'**
  String get heroDescription;

  /// No description provided for @activeProxies.
  ///
  /// In en, this message translates to:
  /// **'Active proxies'**
  String get activeProxies;

  /// No description provided for @availableCapacity.
  ///
  /// In en, this message translates to:
  /// **'Available capacity'**
  String get availableCapacity;

  /// No description provided for @searchAliases.
  ///
  /// In en, this message translates to:
  /// **'Search aliases'**
  String get searchAliases;

  /// No description provided for @newProxy.
  ///
  /// In en, this message translates to:
  /// **'New proxy'**
  String get newProxy;

  /// No description provided for @yourProxies.
  ///
  /// In en, this message translates to:
  /// **'Your proxies'**
  String get yourProxies;

  /// No description provided for @noProxies.
  ///
  /// In en, this message translates to:
  /// **'No proxy addresses yet. Create one to get started.'**
  String get noProxies;

  /// No description provided for @recipients.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1 {1 recipient} other {{count} recipients}}'**
  String recipients(num count);

  /// No description provided for @forwarded.
  ///
  /// In en, this message translates to:
  /// **'{count} forwarded'**
  String forwarded(Object count);

  /// No description provided for @forwardingRecipients.
  ///
  /// In en, this message translates to:
  /// **'Forwarding recipients'**
  String get forwardingRecipients;

  /// No description provided for @enableOrDisableRecipients.
  ///
  /// In en, this message translates to:
  /// **'Enable or disable all forwarding recipients'**
  String get enableOrDisableRecipients;

  /// No description provided for @copyAddress.
  ///
  /// In en, this message translates to:
  /// **'Copy address'**
  String get copyAddress;

  /// No description provided for @copied.
  ///
  /// In en, this message translates to:
  /// **'{address} copied'**
  String copied(Object address);

  /// No description provided for @someCouldNotEnable.
  ///
  /// In en, this message translates to:
  /// **'Some forwarding recipients could not be enabled. Forwarding is on for {count} recipient(s). {detail}'**
  String someCouldNotEnable(Object count, Object detail);

  /// No description provided for @someCouldNotDisable.
  ///
  /// In en, this message translates to:
  /// **'Some forwarding recipients could not be disabled. Forwarding remains on. {detail}'**
  String someCouldNotDisable(Object detail);

  /// No description provided for @settingsPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsPlaceholder;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @english.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get english;

  /// No description provided for @spanish.
  ///
  /// In en, this message translates to:
  /// **'Spanish'**
  String get spanish;

  /// No description provided for @welcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome to ProxiedMail'**
  String get welcome;

  /// No description provided for @createAccountTitle.
  ///
  /// In en, this message translates to:
  /// **'Create your ProxiedMail account'**
  String get createAccountTitle;

  /// No description provided for @manageAliases.
  ///
  /// In en, this message translates to:
  /// **'Manage private aliases without exposing your inbox.'**
  String get manageAliases;

  /// No description provided for @token.
  ///
  /// In en, this message translates to:
  /// **'Token'**
  String get token;

  /// No description provided for @enterToken.
  ///
  /// In en, this message translates to:
  /// **'Enter your API token'**
  String get enterToken;

  /// No description provided for @startManaging.
  ///
  /// In en, this message translates to:
  /// **'Start managing private forwarding addresses.'**
  String get startManaging;

  /// No description provided for @email.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @enterEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter your email'**
  String get enterEmail;

  /// No description provided for @passwordLength.
  ///
  /// In en, this message translates to:
  /// **'Use at least 8 characters'**
  String get passwordLength;

  /// No description provided for @createAccount.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get createAccount;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signIn;

  /// No description provided for @alreadyAccount.
  ///
  /// In en, this message translates to:
  /// **'Already have an account? Sign in'**
  String get alreadyAccount;

  /// No description provided for @needAccount.
  ///
  /// In en, this message translates to:
  /// **'Need an account? Create one'**
  String get needAccount;

  /// No description provided for @accountCreated.
  ///
  /// In en, this message translates to:
  /// **'Account created. Sign in to continue.'**
  String get accountCreated;

  /// No description provided for @newProxyAddress.
  ///
  /// In en, this message translates to:
  /// **'New proxy address'**
  String get newProxyAddress;

  /// No description provided for @editProxy.
  ///
  /// In en, this message translates to:
  /// **'Edit proxy'**
  String get editProxy;

  /// No description provided for @saveChanges.
  ///
  /// In en, this message translates to:
  /// **'Save changes'**
  String get saveChanges;

  /// No description provided for @alias.
  ///
  /// In en, this message translates to:
  /// **'Alias'**
  String get alias;

  /// No description provided for @domain.
  ///
  /// In en, this message translates to:
  /// **'Domain'**
  String get domain;

  /// No description provided for @forwardTo.
  ///
  /// In en, this message translates to:
  /// **'Forward to'**
  String get forwardTo;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @create.
  ///
  /// In en, this message translates to:
  /// **'Create'**
  String get create;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'es'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'es':
      return AppLocalizationsEs();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
