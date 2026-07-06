export {
  RevinelProvider,
  type RevinelProviderProps,
  type RevinelQueryState,
  useRevinelClient,
  useRevinelConfig,
} from "./provider"

export {
  type RevinelAdOptions,
  type RevinelAdsOptions,
  type RevinelCheckoutResult,
  type RevinelTiersOptions,
  type RevinelTrackingOptions,
  type RevinelTrackingResult,
  useAd,
  useAds,
  useCheckout,
  useTiers,
  useTracking,
} from "./hooks"

export {
  TierSelector,
  type RevinelTierSelectorDialogProps,
  TierSelectorDialog,
  type RevinelTierSelectorProps,
} from "./tier-selector"

export { parseTierFeature } from "@revinel/sdk"

export type {
  RevinelEmbedCheckoutEvent,
  RevinelEmbedErrorEvent,
  RevinelEmbedMessage,
  RevinelEmbedTheme,
} from "@revinel/embeds"

export type * from "@revinel/sdk"
