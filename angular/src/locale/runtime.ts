import { loadTranslations } from '@angular/localize'

export type SupportedLocale = 'en' | 'es'

const localeKey = 'proxiedmail.locale'

const spanishTranslations: Record<string, string> = {
  '4930506384627295710': 'Configuración',
  '6570363013146073520': 'Panel',
  '2949848596707725099': 'Cerrar sesión',
  '6428004980068504649': 'GESTIÓN DE PROXIES',
  '5364310210470242600': 'Direcciones proxy',
  '7018921981310252908': 'Proxies activos',
  '5381464865764282983': 'Capacidad disponible',
  '6064307688826871087': 'NUEVA DIRECCIÓN PROXY',
  '3719584865242260706': 'Proxy',
  '5193539160604294602': 'Generar',
  '966975180773840600': 'Dominio',
  '648726851592149010': 'Correo de destino',
  '9011508477052563567': 'No hay correos coincidentes',
  '5674286808255988565': 'Crear',
  '4971516674166640292': 'Buscar alias',
  '7926442034281312121': 'Cargando proxies...',
  '7585826646011739428': 'Editar',
  '1883138045798839334': 'destinatario(s)',
  '2630346684249694851': 'reenviado(s)',
  '2223283913032152637': 'Reenvío',
  '2159130950882492111': 'Cancelar',
  '7000649363168371045': 'Guardar cambios',
  '5347097826955887406': 'CONFIGURACIÓN DE LA CUENTA',
  '1271180106462684426': 'Controla las preferencias de tu cuenta y tus integraciones.',
  '5063842922150713988': 'Cargando configuración...',
  '1975336893361348045': 'Este navegador',
  '1277092044903718527': 'Estas opciones solo se guardan en este navegador.',
  '8951128623878467862': 'Preferencias',
  '5686160216554098320': 'Esta configuración solo se aplica a este navegador, salvo que se indique lo contrario.',
  '2826581353496868063': 'Idioma',
  '5866254605255506989': 'Inglés',
  '5190825892106392539': 'Español',
  '651854741571738747': 'Ocultar iam-rich.net de la lista de dominios proxy',
  '4073760267688290583': 'Tu cuenta',
  '3540672678893696165': 'Estas opciones se guardan en tu cuenta de ProxiedMail.',
  '1647179447280058192': 'Retención de mensajes recibidos',
  '4776429682428363094': '1 día',
  '867108466740792122': '3 días',
  '8372007266188249803': 'Nunca',
  '2629086756321773893': 'Guardar retención',
  '8878700331247603166': 'Seguridad',
  '29442318690635301': 'La autenticación de dos factores protege los cambios de tu cuenta.',
  '3892825090402620438': 'Autenticación de dos factores',
  '2658424416565652268': 'Desactivar la autenticación de dos factores',
  '9215140276209199106': 'La configuración de dos factores aún no está disponible en este cliente.',
  '283145638756863919': 'INTEGRACIÓN',
  '4133860116578220565': 'Configuración de Bitwarden',
  '2735699942611471631': 'Esta integración emula actualmente la integración de Addy.io de Bitwarden. Pide a Bitwarden que añada una integración propia de ProxiedMail en la solicitud de integración de ProxiedMail.',
  '81150266015662754': 'En Bitwarden, abre Generador, elige Nombre de usuario y después Alias de correo reenviado.',
  '4671562292257026998': 'Clave API',
  '4665128552541533965': 'Dominio de correo',
  '7459500313189963649': 'URL del servidor autoalojado',
  '2661655895393078244': 'Selecciona Generar para crear el alias en ProxiedMail.',
  '850347024917789763': 'Tus dominios de correo disponibles son:',
  '2764815722505395699': 'Trata esta clave API como una contraseña. Cualquiera que la tenga puede acceder a tu cuenta de ProxiedMail.',
  '3024936642202493550': 'Dominios de correo disponibles',
  '412098242291426657': 'No se pudo cargar la configuración.',
  '2037812837109831482': 'Configuración guardada.',
  '8118866603612492394': 'No se pudo guardar la configuración.',
  '1776537486744869379': 'Autenticación de dos factores desactivada.',
  '5767650259795109024': 'No se pudo desactivar la autenticación de dos factores.',
}

export function currentLocale(): SupportedLocale {
  return localStorage.getItem(localeKey) === 'es' ? 'es' : 'en'
}

export function initializeLocale() {
  if (currentLocale() === 'es') loadTranslations(spanishTranslations)
}

export function setLocale(locale: SupportedLocale) {
  localStorage.setItem(localeKey, locale)
  window.location.reload()
}
