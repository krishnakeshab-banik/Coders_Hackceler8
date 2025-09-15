import { auth } from "./auth";
import router from "./router";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel"; // Corrected path
// Removed: import { HttpAction, Request } from "convex/server";

const http = router;

// Removed the problematic http.route definition

auth.addHttpRoutes(http);

export default http;
