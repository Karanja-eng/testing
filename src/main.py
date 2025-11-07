from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import GPT2Tokenizer, GPT2LMHeadModel
import torch
import uvicorn

app = FastAPI()

# Load GPT-2 Small model and tokenizer
tokenizer = GPT2Tokenizer.from_pretrained("gpt2")
model = GPT2LMHeadModel.from_pretrained("gpt2")


# Define request schema
class Prompt(BaseModel):
    text: str


app = FastAPI()

# Set pad token to eos token
tokenizer.pad_token = tokenizer.eos_token
model.config.pad_token_id = tokenizer.eos_token_id

# Allow requests from React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Define route
@app.post("/generate")
def generate_text(prompt: Prompt):
    # Ensure pad token is set before tokenization
    tokenizer.pad_token = tokenizer.eos_token

    # Tokenize with padding and attention mask
    inputs = tokenizer(prompt.text, return_tensors="pt", padding=True, truncation=True)

    # Generate with attention mask and pad token
    outputs = model.generate(
        input_ids=inputs["input_ids"],
        attention_mask=inputs["attention_mask"],
        max_length=100,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id,
    )

    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return {"response": response}


# Auto-run server when script is executed directly
if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
