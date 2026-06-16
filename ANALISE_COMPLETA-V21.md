# Análise Completa — V21 Google Login Seguro

## Objetivo da V21

Esta versão remove o login anônimo e transforma o acesso em login Google obrigatório, restrito aos dois e-mails autorizados:

- contato.marcusbuceles@gmail.com
- contato.ingridbuceles@gmail.com

## Alterações aplicadas

- Removido `firebase.auth().signInAnonymously()`.
- Adicionado `firebase.auth.GoogleAuthProvider()`.
- Criada tela bloqueadora de login.
- Adicionado botão "Entrar com Google".
- Adicionado fallback para redirecionamento quando popup for bloqueado.
- Adicionado botão "Sair".
- Sincronização Firebase só inicia após login autorizado.
- Documento Firestore continua em `casais/marcus_e_ingrid`.
- Payload da nuvem agora salva `usuarioGoogle` com e-mail/nome/uid/foto.
- Regras do Firestore atualizadas para permitir leitura e escrita somente aos e-mails autorizados.
- Cache do Service Worker atualizado para V21.

## Itens que você precisa ativar manualmente

No Firebase Console:

1. Authentication > Sign-in method > Google > Enable.
2. Authentication > Sign-in method > Anonymous > Disable.
3. Authentication > Settings > Authorized domains > adicionar `docx7.github.io` se ainda não estiver.
4. Firestore Database > Rules > publicar o conteúdo de `firestore.rules`.

## Resultado esperado

Ao abrir o app, aparece uma tela de login. O app só libera acesso se a conta Google for uma destas:

- contato.marcusbuceles@gmail.com
- contato.ingridbuceles@gmail.com

Qualquer outro e-mail será desconectado e bloqueado.
