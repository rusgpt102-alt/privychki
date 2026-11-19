if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'});
      await registration.update();
    } catch (error) {
      console.error('Не удалось подготовить приложение для работы без интернета.', error);
    }
  });
}
