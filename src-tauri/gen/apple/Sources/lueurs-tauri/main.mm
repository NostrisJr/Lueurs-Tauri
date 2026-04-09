#include "bindings/bindings.h"
#import <Foundation/Foundation.h>

// En mode dev, iOS bloque les connexions réseau local via BSD sockets (reqwest)
// sans jamais afficher le dialog de permission. Ce trigger force le dialog
// via NSNetServiceBrowser (API Apple) avant que Tauri initialise la WebView.
#if DEBUG
static void triggerLocalNetworkPermission(void) {
  NSNetServiceBrowser *browser = [[NSNetServiceBrowser alloc] init];
  [browser searchForServicesOfType:@"_http._tcp." inDomain:@"local."];
  // Faire tourner le run loop pour que iOS puisse afficher le dialog
  [[NSRunLoop currentRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:1.0]];
  [browser stop];
}
#endif

int main(int argc, char * argv[]) {
#if DEBUG
  triggerLocalNetworkPermission();
#endif
  ffi::start_app();
  return 0;
}
