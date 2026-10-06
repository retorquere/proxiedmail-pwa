declare module '*.yaml' {
  type LocaleMessages = { [key: string]: string | LocaleMessages }
  const messages: LocaleMessages
  export default messages
}
