import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

const gameMatchSchema = new Schema(
  {
    inviteId: { type: String, required: true, unique: true, maxlength: 80 },
    whitePlayerId: { type: String, required: true, maxlength: 64 },
    blackPlayerId: { type: String, default: null, maxlength: 64 },
    // State includes the hidden RPG fields. API code deliberately projects them
    // out before serializing a match to either player's browser.
    state: { type: Schema.Types.Mixed, required: true },
    version: { type: Number, required: true, default: 1, min: 1 },
    schemaVersion: { type: Number },
    rulesetVersion: { type: String },
    configVersion: { type: String },
    receipts: { type: [Schema.Types.Mixed], default: [] },
    // Refreshed on every write. Matches saved before this field existed have
    // no expiry and are kept.
    expiresAt: { type: Date },
  },
  { timestamps: true, minimize: false },
);

gameMatchSchema.index({ updatedAt: -1 });
gameMatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
gameMatchSchema.index({ whitePlayerId: 1, blackPlayerId: 1, createdAt: -1 });

export const GameMatch =
  (models.GameMatch as
    Model<InferSchemaType<typeof gameMatchSchema>> | undefined) ||
  model("GameMatch", gameMatchSchema);
