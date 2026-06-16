# Eterno Compromisso — V21 Google Login Seguro

Aplicativo devocional para casal e família, com plano bíblico cronológico, IA devocional, oração, diário, progresso de Marcus/Ingrid, rotina guiada, estudo bíblico, família no altar, relatórios e PWA offline.

## Novidade principal V21

- Login anônimo removido do código.
- Login Google obrigatório.
- Acesso permitido somente para:
  - contato.marcusbuceles@gmail.com
  - contato.ingridbuceles@gmail.com
- `firestore.rules` atualizado para bloquear qualquer outro usuário.
- A tela inicial fica bloqueada até entrar com uma conta Google autorizada.
- Botão de sair da conta Google adicionado no app.

## Antes de publicar

No Firebase Console:

1. Vá em Authentication > Sign-in method.
2. Ative Google.
3. Desative Anonymous.
4. Em Authentication > Settings > Authorized domains, confirme/adicone: `docx7.github.io`.
5. Publique o arquivo `firestore.rules` atualizado no Firestore Rules.

## Publicação

Suba todos os arquivos para o GitHub Pages no repositório do app.

## Observação

A camada de IA foi preservada conforme solicitado. As chaves não foram alteradas.
