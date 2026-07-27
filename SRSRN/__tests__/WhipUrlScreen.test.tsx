/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import {WhipUrlScreen} from '../features/whip/WhipUrlScreen';
import {DEFAULT_WHIP_URL} from '../features/whip/validation';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'whip-url-error'}).length > 0;
}

function render() {
  const navigate = jest.fn();
  const navigation = {navigate, goBack: () => {}, addListener: () => () => {}} as never;
  const route = {key: 'WhipUrl-test', name: 'WhipUrl' as const} as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<WhipUrlScreen navigation={navigation} route={route} />);
  });
  return {tree, navigate};
}

describe('WhipUrlScreen', () => {
  it('prefills the input with DEFAULT_WHIP_URL on mount', () => {
    const {tree} = render();
    expect(findByTestID(tree.root, 'whip-url-input').props.value).toBe(DEFAULT_WHIP_URL);
  });
  it('navigates to Publisher with the default URL when Connect is tapped', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-connect').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('Publisher', {whipUrl: DEFAULT_WHIP_URL});
  });
  it('shows an error and does not navigate when the URL is invalid', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-input').props.onChangeText('not a url');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('shows an error for non-http(s) URLs and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-input').props.onChangeText('ftp://host/x');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('keeps the URL editable', () => {
    const {tree} = render();
    const input = findByTestID(tree.root, 'whip-url-input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText('https://example.com/whip');
    });
    expect(input.props.value).toBe('https://example.com/whip');
  });
});
