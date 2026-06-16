import ExpoModulesCore
import MediaPlayer

private let onNextTrack = "onNextTrack"
private let onPreviousTrack = "onPreviousTrack"

public class YoriaxRemoteCommandsModule: Module {
  private var nextTarget: Any?
  private var previousTarget: Any?

  public func definition() -> ModuleDefinition {
    Name("YoriaxRemoteCommands")

    Events(onNextTrack, onPreviousTrack)

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

  private func enableTrackCommands() {
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
