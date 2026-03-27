class InferenceManager {
    constructor(api) {
        this.api = api
        this.abortController = null
        /*
        this.api = {
            "api": "https://api.openai.com/v1/completions",
            "api_key": "",
            "model": "text-davinci-003",

        }
        */
    }

    stopGeneration() {
        if (this.abortController) {
            this.abortController.abort()
            this.abortController = null
        }
    }

    applyPreset(messages, preset) {
        let keys = Object.keys(preset);
        let presetPrompt = ""
        for (let key of keys){
            if (key.endsWith("-1")) { // active in ui
                presetPrompt += "\n" + preset[key]
            }
        }

        if (messages.length > 0 && presetPrompt.trim()) {
            messages[0]["content"] = presetPrompt.trim() + "\n" + messages[0]["content"]
        }
        return messages
    }

    estimateTokens(messages) {
        let tokens = 0
        for (let message of messages) {
            tokens += message["content"].length
        }
        return Math.ceil(tokens / 4) // rough estimate: ~4 chars per token
    }

    applyContext(messages, context) {
        // truncate middle of messages
        // context = 0 means no limit, so skip truncation
        if (context > 0) {
            while (messages.length > 1 && this.estimateTokens(messages) > context) {
                messages.splice(1, 1)
            }
        }

        return messages
    }

    applyArrangement(messages, arrangement) {
        if (arrangement == 3) {
            return messages
        }
        else if (arrangement == 1) {
            for (let message of messages) {
                if (message["role"] == "system") {
                    message["role"] = "user"
                }
            }
        }

        // Remove consecutive duplicate roles (arrangement == 2 or after applying arrangement == 1)
        let lastRole = null
        for (let i = 0; i < messages.length; i++) {
            if (messages[i]["role"] == lastRole) {
                messages[i-1]["content"] += "\n" + messages[i]["content"] // avoid loss of context
                messages.splice(i, 1)
                i-- // adjust index after removal
            }
            lastRole = messages[i]["role"]
        }

        return messages
    }

    preprocessChat(messages, arrangement=0, preset={}, context_length=0) {
        /*
        
        arrangement:
            0: system, user, assistant, user, assistant 
            1: user, assistant, user, assistant
            2: no repeats
            3: any

        */

        // steps: apply preset, apply context length, apply arrangement

        messages = this.applyPreset(messages, preset)
        
        // apply context length

        messages = this.applyContext(messages, context_length)

        // apply arrangement

        messages = this.applyArrangement(messages, arrangement)

        return messages

    }

    async generateResponse(messages, config, streaming=false, streamCallback=null) {
        // assuming the api is OAI
        this.abortController = new AbortController()
        const response = await fetch(this.api["api"], {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + this.api["api_key"]
            },
            body: JSON.stringify({
                "model": this.api["model"],
                "messages": messages,
                "stream": streaming,
                "temperature": config.temperature || 0.6, // per qwen team's reccomendation
                "top_p": config.top_p || null,
                "max_tokens": config.max_tokens || null,
                "presence_penalty": config.presence_penalty || null,
                "frequency_penalty": config.frequency_penalty || null,
            }),
            signal: this.abortController.signal
        })

        if (streaming) {
            for await (const chunk of response.body) {
                streamCallback(chunk);
            }
        }
        else {
            return response.json();
        }
    }

}

export { InferenceManager };