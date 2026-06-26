import ExpoModulesCore

public class DecorativeVideoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("YoriaxDecorativeVideo")

    View(DecorativeVideoView.self) {
      Prop("source") { (view: DecorativeVideoView, source: String?) in
        view.source = source
      }

      Prop("active") { (view: DecorativeVideoView, active: Bool) in
        view.active = active
      }

      Prop("contentFit") { (view: DecorativeVideoView, contentFit: String) in
        view.contentFit = contentFit
      }
    }
  }
}
