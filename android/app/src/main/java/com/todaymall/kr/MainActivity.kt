package com.todaymall.kr

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // The activity is launched with LaunchTheme (logo on white) so the user
    // sees the splash visual the moment Android shows the window. As soon as
    // we hit onCreate we swap to AppTheme — that way the launch drawable
    // isn't kept as the windowBackground under every screen during normal
    // app use, and the React-rendered SplashScreen takes over seamlessly
    // once the JS bundle finishes loading.
    setTheme(R.style.AppTheme)
    super.onCreate(savedInstanceState)
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    // Android dispatches window-focus events during cold start before the JS
    // bundle has initialized the React host. Forwarding them in that window
    // makes ReactHost log a noisy ReactNoCrashSoftException ("Tried to
    // access onWindowFocusChange while context is not ready"). Skip the
    // forward until the React context exists; subsequent focus changes go
    // through the normal path.
    val reactReady = (application as? ReactApplication)
        ?.reactHost
        ?.currentReactContext != null
    if (!reactReady) {
      return
    }
    super.onWindowFocusChanged(hasFocus)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "todaymall"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
