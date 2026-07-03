import ExpoModulesCore
import AVFoundation
import AdServices
import MediaPlayer
import UIKit

private let onNextTrack = "onNextTrack"
private let onPreviousTrack = "onPreviousTrack"
private let onAudioInterruption = "onAudioInterruption"

public class YoriaxRemoteCommandsModule: Module {
  private var nextTarget: Any?
  private var previousTarget: Any?
  private var interruptionObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("YoriaxRemoteCommands")

    Events(onNextTrack, onPreviousTrack, onAudioInterruption)

    OnCreate {
      // Surface AVAudioSession interruptions (phone calls, Siri, timers) to JS
      // so playback can auto-resume when iOS says it is appropriate. This is
      // the only reliable way to distinguish an interruption from a deliberate
      // user pause on the lock screen.
      self.interruptionObserver = NotificationCenter.default.addObserver(
        forName: AVAudioSession.interruptionNotification,
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard let self,
              let info = notification.userInfo,
              let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }

        switch type {
        case .began:
          self.sendEvent(onAudioInterruption, ["type": "began", "shouldResume": false])
        case .ended:
          let optionsValue = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
          let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
          self.sendEvent(onAudioInterruption, [
            "type": "ended",
            "shouldResume": options.contains(.shouldResume),
          ])
        @unknown default:
          break
        }
      }
    }

    OnDestroy {
      if let observer = self.interruptionObserver {
        NotificationCenter.default.removeObserver(observer)
        self.interruptionObserver = nil
      }
    }

    Function("activatePlaybackSession") {
      DispatchQueue.main.async {
        self.activatePlaybackSession()
      }
    }

    // Apple Search Ads attribution token (AdServices). The JS side posts it to
    // Apple's attribution API to learn which ad campaign drove the install.
    AsyncFunction("getAdAttributionToken") { () -> String? in
      if #available(iOS 14.3, *) {
        return try? AAAttribution.attributionToken()
      }
      return nil
    }

    Function("setEnabled") { (enabled: Bool) in
      DispatchQueue.main.async {
        if enabled {
          self.enableTrackCommands()
        } else {
          self.disableTrackCommands()
        }
      }
    }
  }

  private func activatePlaybackSession() {
    do {
      let session = AVAudioSession.sharedInstance()
      if session.category != .playback || session.mode != .default || !session.categoryOptions.isEmpty {
        try session.setCategory(.playback, mode: .default, options: [])
      }
      try session.setActive(true)
      UIApplication.shared.beginReceivingRemoteControlEvents()
    } catch {
      print("YoriaxRemoteCommands failed to activate playback session: \(error)")
    }
  }

  private func enableTrackCommands() {
    activatePlaybackSession()

    let commandCenter = MPRemoteCommandCenter.shared()

    if nextTarget == nil {
      commandCenter.nextTrackCommand.isEnabled = true
      nextTarget = commandCenter.nextTrackCommand.addTarget { [weak self] _ in
        DispatchQueue.main.async {
          self?.sendEvent(onNextTrack)
        }
        return .success
      }
    }

    if previousTarget == nil {
      commandCenter.previousTrackCommand.isEnabled = true
      previousTarget = commandCenter.previousTrackCommand.addTarget { [weak self] _ in
        DispatchQueue.main.async {
          self?.sendEvent(onPreviousTrack)
        }
        return .success
      }
    }
  }

  private func disableTrackCommands() {
    let commandCenter = MPRemoteCommandCenter.shared()

    if let nextTarget {
      commandCenter.nextTrackCommand.removeTarget(nextTarget)
      self.nextTarget = nil
    }

    if let previousTarget {
      commandCenter.previousTrackCommand.removeTarget(previousTarget)
      self.previousTarget = nil
    }

    commandCenter.nextTrackCommand.isEnabled = false
    commandCenter.previousTrackCommand.isEnabled = false
  }
}
