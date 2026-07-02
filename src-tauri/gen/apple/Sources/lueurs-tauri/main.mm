#include "bindings/bindings.h"
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

static UIView *gNativeSplash = nil;

// Appelée depuis Rust via FFI pour retirer l'overlay natif.
extern "C" void dismiss_native_splash_screen(void) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIView animateWithDuration:0.25
                     animations:^{ gNativeSplash.alpha = 0.0; }
                     completion:^(BOOL _) {
      [gNativeSplash removeFromSuperview];
      gNativeSplash = nil;
    }];
  });
}

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

  // Dès que le UIWindow principal devient actif, on pose un overlay blanc
  // identique au LaunchScreen pour couvrir le WebView pendant son initialisation.
  [[NSNotificationCenter defaultCenter]
      addObserverForName:UIWindowDidBecomeKeyNotification
                  object:nil
                   queue:[NSOperationQueue mainQueue]
              usingBlock:^(NSNotification *note) {
    if (gNativeSplash) return;
    UIWindow *window = (UIWindow *)note.object;

    gNativeSplash = [[UIView alloc] initWithFrame:window.bounds];
    gNativeSplash.backgroundColor = [UIColor whiteColor];
    gNativeSplash.autoresizingMask =
        UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;

    UILabel *title = [[UILabel alloc] init];
    title.text = @"Lueurs";
    title.font = [UIFont systemFontOfSize:36.0 weight:UIFontWeightSemibold];
    title.textColor = [UIColor labelColor];
    title.translatesAutoresizingMaskIntoConstraints = NO;
    [gNativeSplash addSubview:title];

    UILabel *subtitle = [[UILabel alloc] init];
    subtitle.text = @"par Théophile Donato";
    subtitle.font = [UIFont systemFontOfSize:14.0 weight:UIFontWeightRegular];
    subtitle.textColor = [UIColor secondaryLabelColor];
    subtitle.translatesAutoresizingMaskIntoConstraints = NO;
    [gNativeSplash addSubview:subtitle];

    [NSLayoutConstraint activateConstraints:@[
      [title.centerXAnchor constraintEqualToAnchor:gNativeSplash.centerXAnchor],
      [title.centerYAnchor constraintEqualToAnchor:gNativeSplash.centerYAnchor],
      [subtitle.centerXAnchor constraintEqualToAnchor:gNativeSplash.centerXAnchor],
      [subtitle.bottomAnchor
          constraintEqualToAnchor:gNativeSplash.safeAreaLayoutGuide.bottomAnchor
                         constant:-24.0],
    ]];

    [window addSubview:gNativeSplash];
  }];

  ffi::start_app();
  return 0;
}
