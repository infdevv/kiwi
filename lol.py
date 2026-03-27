import discord
from discord.ext import commands
import json
import os
import random

# --- Configuration ---
BOT_TOKEN = 'MTI1MzM5MDg5Mjc0MDY0MDkwOA.GSqzeW.ShJFvTwPYCj7UyYsqwp11UqwSJk2R3VFYNGJ5M'
JSON_FILE = 'user_styles.json'

# --- JSON Helper Functions ---
def load_data():
    if not os.path.exists(JSON_FILE):
        return {}
    try:
        with open(JSON_FILE, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError:
        return {}

def save_data(data):
    with open(JSON_FILE, 'w') as f:
        json.dump(data, f, indent=4)

# --- Bot Setup ---
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

# --- The Button Class ---
class PunctuationButton(discord.ui.Button):
    def __init__(self, base_message):
        # We store the base message text to modify it later
        super().__init__(label="Read", style=discord.ButtonStyle.primary)
        self.base_message = base_message

    async def callback(self, interaction: discord.Interaction):
        user_id = str(interaction.user.id)
        data = load_data()

        # Ensure the main message entry exists (safety check)
        # We use the message ID as the key for the specific text variations
        msg_id = str(interaction.message.id)
        
        if msg_id not in data:
            # If for some reason the message ID isn't in DB, initialize it
            data[msg_id] = {"content": self.base_message, "users": {}}

        # Check if user already has a style for this specific message
        if user_id in data[msg_id]["users"]:
            punctuation = data[msg_id]["users"][user_id]
        else:
            # Generate a random punctuation style
            punctuation_options = ['!', '!!', '!?', '...', '!!!', '?!']
            punctuation = random.choice(punctuation_options) + random.choice(punctuation_options) + random.choice(punctuation_options)
            
            # Save the new style for this user
            data[msg_id]["users"][user_id] = punctuation
            save_data(data)

        # Construct the unique message
        # Note: In a real app, you might want smarter parsing to replace existing punctuation
        # Here, we just append the unique punctuation to the base text.
        final_text = f"{self.base_message.rstrip('!.?')} {punctuation}"
        
        await interaction.response.send_message(final_text, ephemeral=True)

# --- The View Container ---
class PunctuationView(discord.ui.View):
    def __init__(self, base_message):
        super().__init__(timeout=None) # timeout=None makes the button persistent
        self.add_item(PunctuationButton(base_message))

# --- Bot Events & Commands ---
@bot.event
async def on_ready():
    print(f'Logged in as {bot.user}!')

@bot.command()
async def create(ctx):
    """
    Usage: !create Your message here
    Creates an embed with a button that gives users unique punctuation.
    """
    
    message_text = """Lorebary, the proxy service made by Sophia is horrid to use for the following reasons.
1. It exposes emails/passwords
2. The devs took 3 months to patch a critical vulnerability
3. No caching at all, so bandwidth is burned for no reason
4. Lorebary hammers APIs like Google AI Studio with requests
5. They blame anyone but themselves for the banwaves"""
    
    # 1. Prepare data
    data = load_data()
    
    # 2. Create the embed
    embed = discord.Embed(
        title="Lorebary",
        description=f"Read about what Lorebary does for user security",
        color=discord.Color.blue()
    )
    
    # 3. Send the message with the button
    # We pass the base text to the View so the button logic can access it
    view = PunctuationView(message_text)
    msg = await ctx.send(embed=embed, view=view)
    
    # 4. Save the initial state to JSON
    # Structure: { "message_id": { "content": "base_text", "users": {} } }
    data[str(msg.id)] = {
        "content": message_text,
        "users": {}
    }
    save_data(data)
    
    #await ctx.message.delete() # Optional: clean up the command call

# --- Run the Bot ---
bot.run(BOT_TOKEN)