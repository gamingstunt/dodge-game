const launchButton = document.getElementById('launchGameButton');
const visitButton = document.getElementById('visitSiteButton');

function openGame(): void {
  window.location.href = './index.html';
}

function openSite(): void {
  const popup = window.open('https://gamingstunt.com', '_blank', 'noopener,noreferrer');

  if (!popup) {
    window.location.href = 'https://gamingstunt.com';
  }
}

launchButton?.addEventListener('click', openGame);
visitButton?.addEventListener('click', openSite);

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'Enter') {
    event.preventDefault();
    openGame();
  }
});
