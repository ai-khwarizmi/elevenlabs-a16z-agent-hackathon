<script lang="ts">
    export let variant: 'primary' | 'secondary' | 'destructive' = 'primary';
    export let icon: string | undefined = undefined;
    export let text: string | undefined = undefined;
    export let onClick: (() => void) | undefined = undefined;
    export let type: 'button' | 'submit' | 'reset' = 'button';
    export let disabled: boolean = false;
  
    const baseClasses = "inline-flex items-center justify-center font-semibold transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed";
    
    const variantClasses = {
      primary: "bg-[#FF6222] hover:bg-[#e55820] text-white",
      secondary: "bg-black hover:bg-neutral-900 text-white border border-white",
      destructive: "bg-[#FF2222] hover:bg-red-600 text-white"
    };
  
    $: classes = `${baseClasses} ${variantClasses[variant]} ${!text && icon ? 'p-4' : 'px-6 py-3'} whitespace-nowrap ${$$props.class || ''}`;
  </script>
  
  <button
    {type}
    {disabled}
    onclick={onClick}
    class={classes}
  >
    {#if icon}
      <span class="w-full h-full flex items-center justify-center">
        <img src={icon} alt="icon" class="w-5 h-5" />
      </span>
    {/if}
    {#if text}
      <div class={icon ? 'ml-2' : ''}>{text}</div>
    {/if}
  </button>