// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Spanish Castilian (`es`).
class AppLocalizationsEs extends AppLocalizations {
  AppLocalizationsEs([String locale = 'es']) : super(locale);

  @override
  String get appTitle => 'ProxiedMail';

  @override
  String get proxies => 'Proxies';

  @override
  String get settings => 'Configuración';

  @override
  String get refresh => 'Actualizar';

  @override
  String get signOut => 'Cerrar sesión';

  @override
  String get privateAddressBook => 'Tu libreta de direcciones privada';

  @override
  String get keepInboxYours => 'Tu bandeja de entrada es tuya.';

  @override
  String get heroDescription =>
      'Cada servicio tiene su propia dirección. Clara, privada y fácil de reemplazar.';

  @override
  String get activeProxies => 'Proxies activos';

  @override
  String get availableCapacity => 'Capacidad disponible';

  @override
  String get twoFactorProtection => 'Protección 2FA';

  @override
  String get on => 'Activada';

  @override
  String get off => 'Desactivada';

  @override
  String get searchAliases => 'Buscar proxies';

  @override
  String get newProxy => 'Nuevo proxy';

  @override
  String get yourProxies => 'Tus proxies';

  @override
  String get noProxies =>
      'Aún no tienes direcciones proxy. Crea una para empezar.';

  @override
  String recipients(num count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count destinatarios',
      one: '1 destinatario',
    );
    return '$_temp0';
  }

  @override
  String forwarded(Object count) {
    return '$count reenviados';
  }

  @override
  String get forwardingRecipients => 'Destinatarios de reenvío';

  @override
  String get enableOrDisableRecipients =>
      'Activar o desactivar todos los destinatarios';

  @override
  String get copyAddress => 'Copiar dirección';

  @override
  String copied(Object address) {
    return '$address copiado';
  }

  @override
  String someCouldNotEnable(Object count, Object detail) {
    return 'No se pudieron activar algunos destinatarios. El reenvío está activo para $count. $detail';
  }

  @override
  String someCouldNotDisable(Object detail) {
    return 'No se pudieron desactivar algunos destinatarios. El reenvío permanece activo. $detail';
  }

  @override
  String get settingsPlaceholder => 'Configuración';

  @override
  String get language => 'Idioma';

  @override
  String get english => 'Inglés';

  @override
  String get spanish => 'Español';

  @override
  String get welcome => 'Bienvenido a ProxiedMail';

  @override
  String get createAccountTitle => 'Crea tu cuenta de ProxiedMail';

  @override
  String get manageAliases =>
      'Administra direcciones privadas sin exponer tu bandeja de entrada.';

  @override
  String get token => 'Token';

  @override
  String get enterToken => 'Introduce tu token de API';

  @override
  String get startManaging =>
      'Empieza a administrar direcciones privadas de reenvío.';

  @override
  String get email => 'Correo electrónico';

  @override
  String get password => 'Contraseña';

  @override
  String get enterEmail => 'Introduce tu correo electrónico';

  @override
  String get passwordLength => 'Usa al menos 8 caracteres';

  @override
  String get createAccount => 'Crear cuenta';

  @override
  String get signIn => 'Iniciar sesión';

  @override
  String get alreadyAccount => '¿Ya tienes una cuenta? Inicia sesión';

  @override
  String get needAccount => '¿Necesitas una cuenta? Créala';

  @override
  String get accountCreated => 'Cuenta creada. Inicia sesión para continuar.';

  @override
  String get newProxyAddress => 'Nueva dirección proxy';

  @override
  String get editProxy => 'Editar proxy';

  @override
  String get saveChanges => 'Guardar cambios';

  @override
  String get alias => 'Alias';

  @override
  String get domain => 'Dominio';

  @override
  String get forwardTo => 'Reenviar a';

  @override
  String get cancel => 'Cancelar';

  @override
  String get create => 'Crear';
}
