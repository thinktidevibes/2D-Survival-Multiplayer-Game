use spacetimedb::{table, reducer, ReducerContext, Identity, Table, log};

// --- PlayerPin Table Definition ---
#[table(name = player_pin, public)]
#[derive(Clone, Debug)]
pub struct PlayerPin {
    #[primary_key]
    player_id: Identity, // Player who owns the pin
    pin_x: i32,         // World X coordinate of the pin
    pin_y: i32,         // World Y coordinate of the pin
}

// --- Reducer to Set/Update Player Pin ---
#[reducer]
pub fn set_player_pin(ctx: &ReducerContext, pin_x: i32, pin_y: i32) -> Result<(), String> {
    let player_id = ctx.sender;

    // Check if player already has a pin
    if let Some(mut existing_pin) = ctx.db.player_pin().player_id().find(&player_id) {
        // Update existing pin
        existing_pin.pin_x = pin_x;
        existing_pin.pin_y = pin_y;
        ctx.db.player_pin().player_id().update(existing_pin);
        log::info!("Player {} updated pin to ({}, {})", player_id, pin_x, pin_y);
    } else {
        // Insert new pin
        let new_pin = PlayerPin {
            player_id,
            pin_x,
            pin_y,
        };
        // Use try_insert
        match ctx.db.player_pin().try_insert(new_pin) {
            Ok(_) => {
                log::info!("Player {} created pin at ({}, {})", player_id, pin_x, pin_y);
            }
            Err(e) => {
                log::error!("Failed to insert pin for player {}: {}", player_id, e);
                return Err("Failed to set pin".to_string());
            }
        }
    }

    Ok(())
} 