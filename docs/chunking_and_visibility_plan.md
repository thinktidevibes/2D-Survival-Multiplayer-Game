# Plan: Chunking & Server-Side Visibility Implementation

This plan outlines the steps to improve client-side chunk-based subscription filtering and implement server-side visibility filters for enhanced security and performance.

**Phase 1: Server-Side Schema & Logic Updates (Adding `chunk_index`)**

*   **Goal:** Add the `chunk_index` field to relevant tables on the server and ensure it's updated correctly.
*   **Steps:**
    1.  **Define `calculate_chunk_index` Helper:** Ensure the `calculate_chunk_index` function (likely in `environment.rs` or `utils.rs`) is accessible. It should take `pos_x`, `pos_y` and return a `u32` chunk index based on `CHUNK_SIZE_TILES` and `WORLD_WIDTH_CHUNKS`.
    2.  **Modify Table Structs (`server/src/lib.rs`):**
        *   Add `pub chunk_index: u32,` field to the following table definitions:
            *   `Player`
            *   `Campfire`
            *   `WoodenStorageBox`
            *   `DroppedItem`
        *   *(Verify Trees, Stones, Mushrooms already have it).*
    3.  **Update Reducers (`server/src/lib.rs`, `server/src/*.rs` modules):**
        *   **`register_player` (`lib.rs`):** Calculate `chunk_index` based on the final `spawn_x`, `spawn_y` and store it in the new `Player` record before insertion.
        *   **`update_player_position` (`lib.rs`):** After calculating `resolved_x`, `resolved_y`, check if the player's `chunk_index` has changed compared to the stored value. If so, update the `chunk_index` field in the `player_to_update` struct before calling `players.identity().update(...)`.
        *   **`place_campfire` (`lib.rs`):** Calculate `chunk_index` from `world_x`, `world_y` and store it in the `new_campfire` struct before insertion.
        *   **`place_wooden_storage_box` (or similar reducer):** Calculate `chunk_index` from placement coordinates and store it in the new `WoodenStorageBox` struct before insertion.
        *   **`drop_item` (or similar reducer):** Calculate `chunk_index` based on the player's position and store it in the new `DroppedItem` struct before insertion.
    4.  **Build & Publish Server:** Run `spacetime publish vibe-survival-game` (or your db name) to apply schema changes. Run `spacetime generate --lang typescript --out-dir ../client/src/generated` to update client bindings.

**Phase 2: Client-Side Subscription Updates (`client/src/hooks/useSpacetimeTables.ts`)**

*   **Goal:** Modify the client to subscribe to the newly chunked entities based on the player's viewport-derived chunks.
*   **Steps:**
    1.  **Identify Target Tables:** `Player`, `Campfire`, `WoodenStorageBox`, `DroppedItem`.
    2.  **Update `useEffect` for Viewport/Chunk Changes:** Locate the `useEffect` hook that calculates `addedChunkIndices` and `removedChunkIndices`.
    3.  **Add New Chunk Subscriptions:** Inside the loop iterating over `newChunkIndices` (where trees/stones/mushrooms are handled):
        *   Create specific SQL queries using the `chunk_index` for each target table:
            *   `SELECT * FROM player WHERE chunk_index = ${chunkIndex}`
            *   `SELECT * FROM campfire WHERE chunk_index = ${chunkIndex}`
            *   `SELECT * FROM wooden_storage_box WHERE chunk_index = ${chunkIndex}`
            *   `SELECT * FROM dropped_item WHERE chunk_index = ${chunkIndex}`
        *   Use `connection.subscriptionBuilder()` to create and store subscription handles for these queries, adding them to `newSpatialSubs`.
        *   Implement `onError` handling similar to existing resource subscriptions.
    4.  **Handle Unsubscriptions:** Ensure the logic handling `removedChunkIndices` also unsubscribes from these new entity types for the chunks that are no longer relevant (iterate stored handles and call `.unsubscribe()`).
    5.  **Remove Broad Subscriptions:** Verify and remove any previous broad subscriptions (`SELECT * FROM player`, etc.) for these tables.
    6.  **(Self-Visibility for Player):** Add a separate, non-spatial subscription to always receive the local player's own data: `SELECT * FROM player WHERE identity = '${connection.identity.toHexString()}'`. Manage this subscription handle outside the chunk logic.
    7.  **Test Client:** Rigorously test that players, campfires, boxes, and dropped items appear/disappear correctly as the player moves between chunks. Check console for subscription errors.

**Phase 3: Server-Side Security Implementation (Visibility Filters)**

*   **Goal:** Prevent the server from sending data to clients that they shouldn't see, regardless of their subscription query.
*   **Steps:**
    1.  **Enable Unstable Features (If Needed):** If using SpacetimeDB 1.1 or later where filters are unstable, add `features = ["unstable"]` to the `spacetimedb` dependency in `server/Cargo.toml`. Re-run `spacetime build`.
    2.  **Define Filters (`server/src/lib.rs` or dedicated module):** For each table requiring protection (`Player`, `Tree`, `Stone`, `Mushroom`, `Campfire`, `WoodenStorageBox`, `DroppedItem`), define a `const YourTableNameVisibilityFilter: Filter = Filter::Sql(...)` annotated with `#[spacetimedb::client_visibility_filter]`.
    3.  **Filter Logic (Viewport-Based Example):** Use the stored `ClientViewport` data. The SQL will be similar for entities with positions:
        ```rust
        // Example Player Filter
        #[client_visibility_filter]
        const PLAYER_VISIBILITY: Filter = Filter::Sql("
            SELECT * FROM player p
            WHERE
                -- Rule 1: Always see self
                p.identity = :sender
            OR
                -- Rule 2: See others if they are within our stored viewport
                EXISTS (
                    SELECT 1 FROM client_viewport v
                    WHERE v.client_identity = :sender
                      AND p.position_x >= v.min_x AND p.position_x <= v.max_x
                      AND p.position_y >= v.min_y AND p.position_y <= v.max_y
                )
        ");

        // Example Tree Filter
        #[client_visibility_filter]
        const TREE_VISIBILITY: Filter = Filter::Sql("
            SELECT * FROM tree t
            WHERE EXISTS (
                SELECT 1 FROM client_viewport v
                WHERE v.client_identity = :sender
                  AND t.pos_x >= v.min_x AND t.pos_x <= v.max_x
                  AND t.pos_y >= v.min_y AND t.pos_y <= v.max_y
            )
        ");

        // Add similar filters for Stone, Mushroom, Campfire, WoodenStorageBox, DroppedItem
        // adapting table aliases and position column names (e.g., pos_x vs position_x).
        ```
    4.  **Build & Publish Server:** Deploy the changes.
    5.  **Test Security:** Attempt (manually or with modified client code) to subscribe to chunks outside the visible area or use broad `SELECT *` queries. Confirm that the server *only* sends data allowed by the visibility filter (within the viewport or the player themselves). Test edge cases like player death, initial connection, etc.

**Important Considerations:**

*   **Performance:** Complex SQL filters can impact performance. Monitor server load. Chunk-based visibility might be more complex SQL but potentially faster for very large worlds.
*   **`ClientViewport` Freshness:** Ensure the client updates its viewport reasonably often via the `update_viewport` reducer. The existing debouncing helps. Consider adding a server-side cleanup for stale `ClientViewport` entries.
*   **Self-Data:** Double-check filters ensure players always see their own essential data (e.g., inventory, player stats, active equipment) even if those tables are filtered spatially for others. Use `OR table.identity_field = :sender` clauses where necessary.
*   **Non-Spatial Data:** Tables without spatial relevance (e.g., `ItemDefinition`, `Recipe`, `WorldState`) generally don't need spatial filtering but should still be marked `public` appropriately if clients need them.

This phased approach allows for incremental implementation and testing. 