<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Portal Relevo | Apps</title>

  <meta name="theme-color" content="#0b2e1b" />
  <link rel="manifest" href="./manifest.json" />

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

  <link rel="stylesheet" href="./styles/relevo-theme.css" />
  <link rel="stylesheet" href="./styles.css" />
</head>

<body class="relevo-theme">
  <header class="top">
    <div class="brand">
      <img src="https://raw.githubusercontent.com/RelevoAmbiental/portal-relevo/refs/heads/main/styles/icons/Logo_atualizada_vertical.png" 
           alt="Relevo" 
           style="width: 100px; margin-bottom: 15px;">
      <div class="title">Apps Relevo</div>
      <div class="subtitle">Atalho rápido para os módulos operacionais</div>
    </div>
  </header>

  <main class="wrap">
    <section class="grid" id="appsGrid">
      </section>

    <footer class="footer">
      <span id="status"></span>
      <div style="margin-top: 20px;">
        <button class="btn btn-ghost" onclick="window.location.href='https://portal.relevo.eco.br/gestao.html'" style="font-size: 12px; opacity: 0.8;">
          <i class="fas fa-arrow-left"></i> Painel de Gestão
        </button>
      </div>
    </footer>
  </main>

  <script src="./apps.config.js"></script>
  <script src="./app.js"></script>
</body>
</html>
